import { pool } from '../config/db.js';

const findAppointmentForUpdate = async (conn, appointmentId) => {
  const [rows] = await conn.query(
    `SELECT id, appointment_code, customer_id, employee_id, status
     FROM appointments
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [appointmentId]
  );
  return rows[0] || null;
};

const findEmployeeUserId = async (conn, employeeId) => {
  const [rows] = await conn.query(
    'SELECT user_id FROM employees WHERE id = ? LIMIT 1',
    [employeeId]
  );
  return rows[0]?.user_id ?? null;
};

const findByAppointmentId = async (conn, appointmentId) => {
  const [rows] = await conn.query(
    'SELECT id, invoice_code FROM invoices WHERE appointment_id = ? LIMIT 1',
    [appointmentId]
  );
  return rows[0] || null;
};

const findAppointmentServicesForUpdate = async (conn, appointmentId) => {
  const [rows] = await conn.query(
    `SELECT ad.service_id, ad.price_at_booking, s.name AS item_name
     FROM appointment_details ad
     LEFT JOIN services s ON s.id = ad.service_id
     WHERE ad.appointment_id = ?
     ORDER BY ad.id
     FOR UPDATE`,
    [appointmentId]
  );
  return rows;
};

const sumAppointmentServices = async (conn, appointmentId) => {
  const [rows] = await conn.query(
    `SELECT SUM(price_at_booking) AS subtotal
     FROM appointment_details
     WHERE appointment_id = ?`,
    [appointmentId]
  );
  return rows[0]?.subtotal ?? null;
};

const createInvoice = async (conn, invoice) => {
  const [result] = await conn.query(
    `INSERT INTO invoices
       (invoice_code, appointment_id, customer_id, created_by, subtotal,
        discount_amount, tax_amount, total_amount, payment_status, notes)
     VALUES (?, ?, ?, ?, ?, 0.00, 0.00, ?, 'unpaid', ?)`,
    [
      invoice.invoice_code,
      invoice.appointment_id,
      invoice.customer_id,
      invoice.created_by,
      invoice.subtotal,
      invoice.total_amount,
      invoice.notes,
    ]
  );
  return result.insertId;
};

const createInvoiceDetails = async (conn, invoiceId, services) => {
  for (const service of services) {
    await conn.query(
      `INSERT INTO invoice_details
         (invoice_id, service_id, item_name, quantity, unit_price, total_price)
       VALUES (?, ?, ?, 1, ?, CAST(? * 1 AS DECIMAL(12, 2)))`,
      [invoiceId, service.service_id, service.item_name, service.price_at_booking, service.price_at_booking]
    );
  }
};

const createSurchargeDetails = async (conn, invoiceId, surcharges) => {
  for (const s of surcharges) {
    const qty = s.quantity ?? 1;
    const unitPrice = s.unit_price;
    await conn.query(
      `INSERT INTO invoice_details
         (invoice_id, service_id, item_name, quantity, unit_price, total_price)
       VALUES (?, NULL, ?, ?, ?, CAST(? * ? AS DECIMAL(12, 2)))`,
      [invoiceId, s.item_name, qty, unitPrice, unitPrice, qty]
    );
  }
};

const findInvoiceForUpdate = async (conn, invoiceId) => {
  const [rows] = await conn.query(
    `SELECT id, invoice_code, appointment_id, customer_id, subtotal,
            discount_amount, tax_amount, total_amount, payment_status, notes
     FROM invoices
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [invoiceId]
  );
  return rows[0] || null;
};

const createPayment = async (conn, payment) => {
  const [result] = await conn.query(
    `INSERT INTO payments
       (invoice_id, payment_code, amount, payment_method, status, processed_by, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.invoice_id,
      payment.payment_code,
      payment.amount,
      payment.payment_method,
      payment.status || 'success',
      payment.processed_by,
      payment.notes || null,
    ]
  );
  return result.insertId;
};

const updatePaymentStatus = async (conn, invoiceId, status) => {
  await conn.query(
    'UPDATE invoices SET payment_status = ? WHERE id = ?',
    [status, invoiceId]
  );
};

const sumSuccessfulPayments = async (conn, invoiceId) => {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(amount), 0) AS total_paid
     FROM payments
     WHERE invoice_id = ? AND status = 'success'`,
    [invoiceId]
  );
  return Number(rows[0]?.total_paid ?? 0);
};

const findById = async (id, conn = pool) => {
  const [rows] = await conn.query(
    `SELECT i.id, i.invoice_code, i.appointment_id, i.customer_id, i.created_by,
            i.subtotal, i.discount_amount, i.tax_amount, i.total_amount,
            i.payment_status, i.notes, i.created_at, i.updated_at,
            a.appointment_code, a.employee_id,
            p.name AS pet_name, p.species AS pet_species,
            u.full_name AS customer_name
     FROM invoices i
     JOIN appointments a ON a.id = i.appointment_id
     JOIN pets p ON p.id = a.pet_id
     JOIN users u ON u.id = i.customer_id
     WHERE i.id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const findDetailsByInvoiceId = async (id, conn = pool) => {
  const [rows] = await conn.query(
    `SELECT id, invoice_id, service_id, item_name, quantity, unit_price, total_price
     FROM invoice_details
     WHERE invoice_id = ?
     ORDER BY id`,
    [id]
  );
  return rows;
};

const findPaymentsByInvoiceId = async (id, conn = pool) => {
  const [rows] = await conn.query(
    `SELECT id, invoice_id, payment_code, amount, payment_method, payment_time, status, notes
     FROM payments
     WHERE invoice_id = ?
     ORDER BY payment_time, id`,
    [id]
  );
  return rows;
};

const list = async ({ role, userId, employeeId, appointmentId, limit, offset }, conn = pool) => {
  const conditions = [];
  const params = [];
  if (role === 'customer') {
    conditions.push('i.customer_id = ?');
    params.push(userId);
  } else if (role === 'staff') {
    conditions.push('a.employee_id = ?');
    params.push(employeeId ?? -1);
  }
  if (appointmentId) {
    conditions.push('i.appointment_id = ?');
    params.push(appointmentId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await conn.query(
    `SELECT i.id, i.invoice_code, i.appointment_id, i.customer_id, i.subtotal,
            i.discount_amount, i.tax_amount, i.total_amount, i.payment_status,
            i.created_at, a.appointment_code, p.name AS pet_name
     FROM invoices i
     JOIN appointments a ON a.id = i.appointment_id
     JOIN pets p ON p.id = a.pet_id
     ${where}
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS total
     FROM invoices i
     JOIN appointments a ON a.id = i.appointment_id
     ${where}`,
    params
  );
  return { rows, total: countRows[0]?.total ?? 0 };
};

export {
  findAppointmentForUpdate,
  findEmployeeUserId,
  findByAppointmentId,
  findAppointmentServicesForUpdate,
  sumAppointmentServices,
  createInvoice,
  createInvoiceDetails,
  createSurchargeDetails,
  findInvoiceForUpdate,
  createPayment,
  updatePaymentStatus,
  sumSuccessfulPayments,
  findById,
  findDetailsByInvoiceId,
  findPaymentsByInvoiceId,
  list,
};

export default {
  findAppointmentForUpdate,
  findEmployeeUserId,
  findByAppointmentId,
  findAppointmentServicesForUpdate,
  sumAppointmentServices,
  createInvoice,
  createInvoiceDetails,
  createSurchargeDetails,
  findInvoiceForUpdate,
  createPayment,
  updatePaymentStatus,
  sumSuccessfulPayments,
  findById,
  findDetailsByInvoiceId,
  findPaymentsByInvoiceId,
  list,
};
