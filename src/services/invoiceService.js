import { randomUUID } from 'node:crypto';
import { pool } from '../config/db.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import employeeRepository from '../repositories/employeeRepository.js';
import logRepository from '../repositories/logRepository.js';
import { notifyInvoice } from './notificationService.js';
import {
  createInvoiceSchema,
  createPaymentSchema,
  invoiceListQuerySchema,
} from '../validations/invoiceSchemas.js';
import { auditContext, httpError, parseId } from '../utils/params.js';

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const MAX_INVOICE_CENTS = 999999999999n;

const toCents = (value) => {
  const str = typeof value === 'number' ? value.toFixed(2) : String(value ?? '');
  if (!MONEY_PATTERN.test(str)) return null;
  const [whole, fraction = ''] = str.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
};

const centsToString = (cents) => {
  const whole = cents / 100n;
  const fraction = cents % 100n;
  return `${whole}.${String(fraction).padStart(2, '0')}`;
};

const createInvoiceCode = () => `INV-${randomUUID().replace(/-/g, '').slice(0, 26).toUpperCase()}`;
const createPaymentCode = () => `PAY-${randomUUID().replace(/-/g, '').slice(0, 26).toUpperCase()}`;

const assertStaffOwnsAppointment = async (actor, appointment, conn) => {
  if (actor.role_name !== 'staff') return;
  if (!appointment.employee_id) {
    throw httpError(403, 'Nhân viên chỉ được lập hóa đơn cho lịch được phân công cho mình.');
  }
  const ownerUserId = await invoiceRepository.findEmployeeUserId(conn, appointment.employee_id);
  if (ownerUserId !== actor.id) {
    throw httpError(403, 'Bạn chỉ được lập hóa đơn cho lịch hẹn được phân công cho mình.');
  }
};

const assertCanViewInvoice = async (actor, invoice) => {
  if (actor.role_name === 'admin') return;
  if (actor.role_name === 'customer') {
    if (invoice.customer_id !== actor.id) throw httpError(404, 'Không tìm thấy hóa đơn.');
    return;
  }
  if (actor.role_name === 'staff') {
    if (!invoice.employee_id) throw httpError(404, 'Không tìm thấy hóa đơn.');
    const employee = await employeeRepository.findByUserId(actor.id);
    if (!employee || employee.id !== invoice.employee_id) {
      throw httpError(404, 'Không tìm thấy hóa đơn.');
    }
    return;
  }
  throw httpError(403, 'Bạn không có quyền xem hóa đơn.');
};

const createForAppointment = async (actor, rawAppointmentId, body = {}, req = {}) => {
  if (!['admin', 'staff'].includes(actor.role_name)) {
    throw httpError(403, 'Chỉ nhân viên hoặc quản trị viên được lập hóa đơn.');
  }
  const appointmentId = parseId(rawAppointmentId, 'Mã lịch hẹn');
  const parsed = createInvoiceSchema.parse(body);
  const conn = await pool.getConnection();
  let transactionStarted = false;
  let invoiceId;
  let createdInvoice;

  try {
    await conn.beginTransaction();
    transactionStarted = true;

    const appointment = await invoiceRepository.findAppointmentForUpdate(conn, appointmentId);
    if (!appointment) throw httpError(404, 'Không tìm thấy lịch hẹn.');
    if (appointment.status !== 'completed') {
      throw httpError(409, 'Chỉ có thể lập hóa đơn cho lịch hẹn đã hoàn thành.');
    }
    await assertStaffOwnsAppointment(actor, appointment, conn);

    if (await invoiceRepository.findByAppointmentId(conn, appointmentId)) {
      throw httpError(409, 'Lịch hẹn này đã có hóa đơn.');
    }

    const services = await invoiceRepository.findAppointmentServicesForUpdate(conn, appointmentId);
    if (
      services.length === 0 ||
      services.some(
        (service) =>
          !Number.isInteger(service.service_id) ||
          !service.item_name ||
          toCents(service.price_at_booking) === null
      )
    ) {
      throw httpError(422, 'Lịch hẹn không có dịch vụ hợp lệ để lập hóa đơn.');
    }

    const subtotal = await invoiceRepository.sumAppointmentServices(conn, appointmentId);
    const subtotalCents = toCents(subtotal);
    if (subtotalCents === null || subtotalCents <= 0n || subtotalCents > MAX_INVOICE_CENTS) {
      throw httpError(422, 'Tổng tiền dịch vụ không hợp lệ hoặc phải lớn hơn 0.');
    }

    let surchargesCents = 0n;
    const validSurcharges = parsed.surcharges || [];
    for (const s of validSurcharges) {
      const priceCents = toCents(s.unit_price);
      if (priceCents === null || priceCents < 0n) {
        throw httpError(422, 'Đơn giá phụ phí không hợp lệ.');
      }
      surchargesCents += priceCents * BigInt(s.quantity ?? 1);
    }

    const totalCents = subtotalCents + surchargesCents;
    if (totalCents > MAX_INVOICE_CENTS) {
      throw httpError(422, 'Tổng tiền hóa đơn vượt quá giới hạn cho phép.');
    }

    const totalAmount = validSurcharges.length > 0 ? centsToString(totalCents) : subtotal;

    const invoice = {
      invoice_code: createInvoiceCode(),
      appointment_id: appointmentId,
      customer_id: appointment.customer_id,
      created_by: actor.id,
      subtotal,
      total_amount: totalAmount,
      notes: parsed.notes ?? null,
    };
    invoiceId = await invoiceRepository.createInvoice(conn, invoice);
    await invoiceRepository.createInvoiceDetails(conn, invoiceId, services);

    if (validSurcharges.length > 0) {
      await invoiceRepository.createSurchargeDetails(conn, invoiceId, validSurcharges);
    }

    createdInvoice = await invoiceRepository.findById(invoiceId, conn);
    createdInvoice.details = await invoiceRepository.findDetailsByInvoiceId(invoiceId, conn);
    createdInvoice.payments = [];

    await conn.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) await conn.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      throw httpError(409, 'Hóa đơn cho lịch hẹn này đã tồn tại hoặc mã hóa đơn bị trùng.');
    }
    throw error;
  } finally {
    conn.release();
  }

  await logRepository.insert({
    ...auditContext(req),
    action: 'CREATE_INVOICE',
    entity_name: 'invoices',
    entity_id: invoiceId,
    new_values: {
      invoice_code: createdInvoice.invoice_code,
      appointment_id: appointmentId,
      total_amount: createdInvoice.total_amount,
    },
  });

  await notifyInvoice('created', {
    customerId: createdInvoice.customer_id,
    invoiceId,
    invoiceCode: createdInvoice.invoice_code,
    amount: createdInvoice.total_amount,
  }, actor);

  return { invoice: createdInvoice };
};

const listInvoices = async (actor, query = {}) => {
  if (!['admin', 'staff', 'customer'].includes(actor.role_name)) {
    throw httpError(403, 'Bạn không có quyền xem hóa đơn.');
  }
  const { page, limit, appointment_id } = invoiceListQuerySchema.parse(query);
  let employeeId;
  if (actor.role_name === 'staff') {
    const employee = await employeeRepository.findByUserId(actor.id);
    employeeId = employee?.id;
  }
  const { rows, total } = await invoiceRepository.list({
    role: actor.role_name,
    userId: actor.id,
    employeeId,
    appointmentId: appointment_id,
    limit,
    offset: (page - 1) * limit,
  });
  return {
    invoices: rows,
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
};

const getInvoiceById = async (actor, rawId) => {
  const id = parseId(rawId, 'Mã hóa đơn');
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) throw httpError(404, 'Không tìm thấy hóa đơn.');
  await assertCanViewInvoice(actor, invoice);
  invoice.details = await invoiceRepository.findDetailsByInvoiceId(id);
  invoice.payments = await invoiceRepository.findPaymentsByInvoiceId(id);
  return { invoice };
};

const recordPayment = async (actor, rawInvoiceId, body = {}, req = {}) => {
  if (!['admin', 'staff'].includes(actor.role_name)) {
    throw httpError(403, 'Chỉ nhân viên hoặc quản trị viên mới được ghi nhận thanh toán.');
  }
  const invoiceId = parseId(rawInvoiceId, 'Mã hóa đơn');
  const parsed = createPaymentSchema.parse(body);

  const conn = await pool.getConnection();
  let transactionStarted = false;
  let paymentId;
  let paymentCode;
  let newStatus;

  try {
    await conn.beginTransaction();
    transactionStarted = true;

    const invoice = await invoiceRepository.findInvoiceForUpdate(conn, invoiceId);
    if (!invoice) throw httpError(404, 'Không tìm thấy hóa đơn.');

    if (invoice.payment_status === 'paid') {
      throw httpError(409, 'Hóa đơn đã được thanh toán đầy đủ.');
    }
    if (invoice.payment_status === 'refunded') {
      throw httpError(409, 'Hóa đơn đã được hoàn tiền, không thể nhận thanh toán.');
    }

    const totalPaid = await invoiceRepository.sumSuccessfulPayments(conn, invoiceId);
    const totalAmount = Number(invoice.total_amount);
    const remaining = Math.max(0, totalAmount - totalPaid);

    if (parsed.amount > remaining) {
      throw httpError(
        422,
        `Số tiền thanh toán (${parsed.amount.toLocaleString('vi-VN')} đ) vượt quá số tiền còn lại cần thanh toán (${remaining.toLocaleString('vi-VN')} đ).`
      );
    }

    paymentCode = createPaymentCode();
    paymentId = await invoiceRepository.createPayment(conn, {
      invoice_id: invoiceId,
      payment_code: paymentCode,
      amount: parsed.amount,
      payment_method: parsed.payment_method,
      status: 'success',
      processed_by: actor.id,
      notes: parsed.notes || null,
    });

    const newTotalPaid = totalPaid + parsed.amount;
    newStatus = newTotalPaid >= totalAmount ? 'paid' : 'partially_paid';
    await invoiceRepository.updatePaymentStatus(conn, invoiceId, newStatus);

    await conn.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await logRepository.insert({
    ...auditContext(req),
    action: 'CREATE_PAYMENT',
    entity_name: 'payments',
    entity_id: paymentId,
    new_values: {
      payment_code: paymentCode,
      invoice_id: invoiceId,
      amount: parsed.amount,
      payment_method: parsed.payment_method,
      new_payment_status: newStatus,
    },
  });

  const updatedInvoice = await invoiceRepository.findById(invoiceId);
  updatedInvoice.details = await invoiceRepository.findDetailsByInvoiceId(invoiceId);
  updatedInvoice.payments = await invoiceRepository.findPaymentsByInvoiceId(invoiceId);

  await notifyInvoice('payment', {
    customerId: updatedInvoice.customer_id,
    invoiceId,
    invoiceCode: updatedInvoice.invoice_code,
    amount: parsed.amount,
    paid: newStatus === 'paid',
  }, actor);

  return {
    message: newStatus === 'paid' ? 'Thanh toán hóa đơn hoàn tất.' : 'Ghi nhận thanh toán một phần thành công.',
    invoice: updatedInvoice,
  };
};

const getVietQR = async (actor, rawInvoiceId) => {
  const invoiceId = parseId(rawInvoiceId, 'Mã hóa đơn');
  const invoice = await invoiceRepository.findById(invoiceId);
  if (!invoice) throw httpError(404, 'Không tìm thấy hóa đơn.');
  await assertCanViewInvoice(actor, invoice);

  const totalPaid = await invoiceRepository.sumSuccessfulPayments(pool, invoiceId);
  const totalAmount = Number(invoice.total_amount);
  const remaining = Math.max(0, totalAmount - totalPaid);

  if (remaining <= 0) {
    throw httpError(400, 'Hóa đơn đã được thanh toán đầy đủ, không cần tạo mã QR thanh toán.');
  }

  const bankId = 'MB';
  const accountNo = '0987654321';
  const accountName = 'PET SPA SYSTEM';
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${remaining}&addInfo=${encodeURIComponent(invoice.invoice_code)}&accountName=${encodeURIComponent(accountName)}`;

  return {
    qr_url: qrUrl,
    bank_name: 'Ngân hàng Quân đội (MBBank)',
    bank_id: bankId,
    account_number: accountNo,
    account_name: accountName,
    amount: remaining,
    description: invoice.invoice_code,
  };
};

export {
  createForAppointment,
  listInvoices,
  getInvoiceById,
  recordPayment,
  getVietQR,
};

export default {
  createForAppointment,
  listInvoices,
  getInvoiceById,
  recordPayment,
  getVietQR,
};
