import { randomUUID } from 'node:crypto';
import { pool } from '../config/db.js';
import invoiceRepository from '../repositories/invoiceRepository.js';
import promotionRepository from '../repositories/promotionRepository.js';
import employeeRepository from '../repositories/employeeRepository.js';
import logRepository from '../repositories/logRepository.js';
import { notifyInvoice } from './notificationService.js';
import {
  createInvoiceSchema,
  createPaymentSchema,
  invoiceListQuerySchema,
} from '../validations/invoiceSchemas.js';
import { auditContext, httpError, parseId } from '../utils/params.js';
import { pickBestPromotion } from '../utils/promotionPicker.js';
import { getVietnamDate } from '../utils/businessDate.js';
import { discountApprovalSchema } from '../validations/promotionSchemas.js';

const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const MAX_INVOICE_CENTS = 999999999999n;

/** Mức giảm giá tối đa (% tổng hóa đơn) nhân viên được tự áp dụng; cấu hình INVOICE_STAFF_MAX_DISCOUNT_PERCENT (mặc định 20) */
const staffMaxDiscountPercent = () => {
  const n = Number(process.env.INVOICE_STAFF_MAX_DISCOUNT_PERCENT);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : 20;
};

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
  let waitingApproval = false;

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

    const grossCents = subtotalCents + surchargesCents;
    if (grossCents > MAX_INVOICE_CENTS) {
      throw httpError(422, 'Tổng tiền hóa đơn vượt quá giới hạn cho phép.');
    }

    // Bước 3: tự tìm khuyến mãi đang hoạt động, đủ điều kiện (chọn chương trình giảm nhiều nhất)
    const promoPick = pickBestPromotion(
      await promotionRepository.findActive(conn, getVietnamDate()),
      services,
      subtotalCents
    );
    const promoCents = promoPick?.discountCents ?? 0n;

    // Bước 4-5: giảm giá thủ công cần lý do; nhân viên vượt hạn mức -> chờ admin duyệt
    const manualCents = toCents(parsed.discount_amount ?? 0);
    if (manualCents === null || manualCents < 0n) {
      throw httpError(422, 'Số tiền giảm giá không hợp lệ.');
    }
    let needsApproval = false;
    if (manualCents > 0n) {
      if (!parsed.discount_reason) {
        throw httpError(422, 'Vui lòng nhập lý do giảm giá (ví dụ: khách thân thiết, dịp lễ).');
      }
      if (promoCents + manualCents >= grossCents) {
        throw httpError(422, 'Tổng giảm giá phải nhỏ hơn tổng tiền hóa đơn.');
      }
      if (actor.role_name === 'staff') {
        const maxPercent = staffMaxDiscountPercent();
        needsApproval = manualCents * 100n > (grossCents - promoCents) * BigInt(maxPercent);
      }
    }
    const appliedManualCents = needsApproval ? 0n : manualCents;

    // Bước 6: tổng tiền cuối cùng
    const discountCents = promoCents + appliedManualCents;
    const totalCents = grossCents - discountCents;
    const totalAmount = validSurcharges.length > 0 || discountCents > 0n ? centsToString(totalCents) : subtotal;

    const invoice = {
      invoice_code: createInvoiceCode(),
      appointment_id: appointmentId,
      customer_id: appointment.customer_id,
      created_by: actor.id,
      subtotal,
      discount_amount: centsToString(discountCents),
      promotion_id: promoPick ? promoPick.promotion.id : null,
      promotion_name: promoPick ? promoPick.promotion.name : null,
      promotion_discount: centsToString(promoCents),
      manual_discount_reason: manualCents > 0n ? parsed.discount_reason : null,
      pending_discount: needsApproval ? centsToString(manualCents) : '0.00',
      approval_status: needsApproval ? 'pending' : 'none',
      total_amount: totalAmount,
      notes: parsed.notes ?? null,
    };
    invoiceId = await invoiceRepository.createInvoice(conn, invoice);
    await invoiceRepository.createInvoiceDetails(conn, invoiceId, services);

    if (validSurcharges.length > 0) {
      await invoiceRepository.createSurchargeDetails(conn, invoiceId, validSurcharges);
    }

    waitingApproval = needsApproval;
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

  if (waitingApproval) {
    // Chờ admin duyệt giảm giá: chưa báo khách, chỉ báo admin
    await notifyInvoice('approval_requested', {
      invoiceId,
      invoiceCode: createdInvoice.invoice_code,
      amount: createdInvoice.pending_discount,
      staffName: actor.full_name,
    }, actor);
  } else {
    await notifyInvoice('created', {
      customerId: createdInvoice.customer_id,
      invoiceId,
      invoiceCode: createdInvoice.invoice_code,
      amount: createdInvoice.total_amount,
    }, actor);
  }

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

    if (invoice.approval_status === 'pending') {
      throw httpError(409, 'Hóa đơn đang chờ quản trị viên duyệt giảm giá, chưa thể thu tiền.');
    }
    if (invoice.payment_status === 'paid') {
      throw httpError(409, 'Hóa đơn đã được thanh toán đầy đủ.');
    }
    if (invoice.payment_status === 'refunded') {
      throw httpError(409, 'Hóa đơn đã được hoàn tiền, không thể nhận thanh toán.');
    }

    // Toàn bộ phép so sánh tiền dùng số nguyên (xu) kiểu BigInt, không dùng số thực
    const totalPaidCents = toCents(await invoiceRepository.sumSuccessfulPayments(conn, invoiceId));
    const totalCents = toCents(invoice.total_amount);
    const amountCents = toCents(parsed.amount);
    if (totalPaidCents === null || totalCents === null || amountCents === null || amountCents <= 0n) {
      throw httpError(422, 'Số tiền thanh toán không hợp lệ.');
    }
    const remainingCents = totalCents > totalPaidCents ? totalCents - totalPaidCents : 0n;

    if (amountCents > remainingCents) {
      throw httpError(
        422,
        `Số tiền thanh toán (${parsed.amount.toLocaleString('vi-VN')} đ) vượt quá số tiền còn lại cần thanh toán (${Number(remainingCents / 100n).toLocaleString('vi-VN')} đ).`
      );
    }

    paymentCode = createPaymentCode();
    paymentId = await invoiceRepository.createPayment(conn, {
      invoice_id: invoiceId,
      payment_code: paymentCode,
      amount: centsToString(amountCents),
      payment_method: parsed.payment_method,
      status: 'success',
      processed_by: actor.id,
      notes: parsed.notes || null,
    });

    newStatus = totalPaidCents + amountCents >= totalCents ? 'paid' : 'partially_paid';
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
  if (invoice.approval_status === 'pending') {
    throw httpError(409, 'Hóa đơn đang chờ quản trị viên duyệt giảm giá, chưa có mã thanh toán.');
  }

  const totalPaidCents = toCents(await invoiceRepository.sumSuccessfulPayments(pool, invoiceId)) ?? 0n;
  const totalCents = toCents(invoice.total_amount) ?? 0n;
  const remainingCents = totalCents > totalPaidCents ? totalCents - totalPaidCents : 0n;
  const remaining = Number(remainingCents / 100n);

  if (remainingCents <= 0n) {
    throw httpError(400, 'Hóa đơn đã được thanh toán đầy đủ, không cần tạo mã QR thanh toán.');
  }

  const bankId = process.env.VIETQR_BANK_ID || 'MB';
  const accountNo = process.env.VIETQR_ACCOUNT_NO || '0987654321';
  const accountName = process.env.VIETQR_ACCOUNT_NAME || 'PET SPA SYSTEM';
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

/** Xem trước khuyến mãi tự áp dụng cho một lịch hẹn đã hoàn tất (để form lập hóa đơn hiển thị) */
const previewInvoice = async (actor, rawAppointmentId) => {
  if (!['admin', 'staff'].includes(actor.role_name)) {
    throw httpError(403, 'Chỉ nhân viên hoặc quản trị viên được lập hóa đơn.');
  }
  const appointmentId = parseId(rawAppointmentId, 'Mã lịch hẹn');
  const appointment = await invoiceRepository.findAppointmentForUpdate(pool, appointmentId);
  if (!appointment) throw httpError(404, 'Không tìm thấy lịch hẹn.');
  await assertStaffOwnsAppointment(actor, appointment, pool);
  const services = await invoiceRepository.findAppointmentServicesForUpdate(pool, appointmentId);
  const subtotalCents = toCents(await invoiceRepository.sumAppointmentServices(pool, appointmentId)) ?? 0n;
  const pick = pickBestPromotion(await promotionRepository.findActive(pool, getVietnamDate()), services, subtotalCents);
  return {
    subtotal: centsToString(subtotalCents),
    promotion: pick
      ? { id: pick.promotion.id, name: pick.promotion.name, discount: centsToString(pick.discountCents) }
      : null,
    staff_max_discount_percent: staffMaxDiscountPercent(),
  };
};

/** Admin duyệt / từ chối giảm giá thủ công vượt hạn mức của nhân viên */
const decideDiscount = async (actor, rawInvoiceId, body = {}, req = {}) => {
  if (actor.role_name !== 'admin') {
    throw httpError(403, 'Chỉ quản trị viên mới được duyệt giảm giá.');
  }
  const invoiceId = parseId(rawInvoiceId, 'Mã hóa đơn');
  const { approve } = discountApprovalSchema.parse(body);

  const conn = await pool.getConnection();
  let transactionStarted = false;
  let invoice;
  try {
    await conn.beginTransaction();
    transactionStarted = true;
    invoice = await invoiceRepository.findInvoiceForUpdate(conn, invoiceId);
    if (!invoice) throw httpError(404, 'Không tìm thấy hóa đơn.');
    if (invoice.approval_status !== 'pending') {
      throw httpError(409, 'Hóa đơn này không có yêu cầu giảm giá đang chờ duyệt.');
    }

    const pendingCents = toCents(invoice.pending_discount) ?? 0n;
    const discountCents = toCents(invoice.discount_amount) ?? 0n;
    const totalCents = toCents(invoice.total_amount) ?? 0n;
    const grossCents = totalCents + discountCents;

    let newDiscount = discountCents;
    let newTotal = totalCents;
    if (approve) {
      newDiscount = discountCents + pendingCents;
      if (newDiscount >= grossCents) {
        throw httpError(422, 'Tổng giảm giá phải nhỏ hơn tổng tiền hóa đơn.');
      }
      newTotal = grossCents - newDiscount;
    }
    await invoiceRepository.resolveDiscountApproval(conn, invoiceId, {
      status: approve ? 'approved' : 'rejected',
      discount_amount: centsToString(newDiscount),
      total_amount: centsToString(newTotal),
      approved_by: actor.id,
    });
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
    action: approve ? 'APPROVE_INVOICE_DISCOUNT' : 'REJECT_INVOICE_DISCOUNT',
    entity_name: 'invoices',
    entity_id: invoiceId,
    new_values: { invoice_code: invoice.invoice_code, pending_discount: invoice.pending_discount },
  });

  const updated = await invoiceRepository.findById(invoiceId);
  updated.details = await invoiceRepository.findDetailsByInvoiceId(invoiceId);
  updated.payments = await invoiceRepository.findPaymentsByInvoiceId(invoiceId);
  await notifyInvoice('discount_decided', {
    customerId: updated.customer_id,
    createdBy: updated.created_by,
    invoiceId,
    invoiceCode: updated.invoice_code,
    amount: updated.total_amount,
    approved: approve,
  }, actor);
  return { invoice: updated };
};

export {
  previewInvoice,
  decideDiscount,
  createForAppointment,
  listInvoices,
  getInvoiceById,
  recordPayment,
  getVietQR,
};

export default {
  previewInvoice,
  decideDiscount,
  createForAppointment,
  listInvoices,
  getInvoiceById,
  recordPayment,
  getVietQR,
};
