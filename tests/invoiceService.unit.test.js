import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const conn = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};
const pool = { getConnection: jest.fn() };
const invoiceRepository = {
  findAppointmentForUpdate: jest.fn(),
  findEmployeeUserId: jest.fn(),
  findByAppointmentId: jest.fn(),
  findAppointmentServicesForUpdate: jest.fn(),
  sumAppointmentServices: jest.fn(),
  createInvoice: jest.fn(),
  createInvoiceDetails: jest.fn(),
  findById: jest.fn(),
  findDetailsByInvoiceId: jest.fn(),
  findPaymentsByInvoiceId: jest.fn(),
  list: jest.fn(),
};
const employeeRepository = { findByUserId: jest.fn() };
const logRepository = { insert: jest.fn() };

jest.unstable_mockModule('../src/config/db.js', () => ({ pool }));
jest.unstable_mockModule('../src/repositories/invoiceRepository.js', () => ({
  default: invoiceRepository,
}));
jest.unstable_mockModule('../src/repositories/employeeRepository.js', () => ({
  default: employeeRepository,
}));
jest.unstable_mockModule('../src/repositories/logRepository.js', () => ({
  default: logRepository,
}));

const { createForAppointment, getInvoiceById, listInvoices } = await import('../src/services/invoiceService.js');

const admin = { id: 1, role_name: 'admin' };
const staff = { id: 2, role_name: 'staff' };
const customer = { id: 3, role_name: 'customer' };
const completedAppointment = {
  id: 10,
  appointment_code: 'APT-TEST-10',
  status: 'completed',
  customer_id: 3,
  employee_id: 20,
};
const serviceLines = [
  { service_id: 4, item_name: 'Bath', price_at_booking: '100.10' },
  { service_id: 5, item_name: 'Trim', price_at_booking: '200.20' },
];

const prepareCreateMocks = () => {
  pool.getConnection.mockResolvedValue(conn);
  conn.beginTransaction.mockResolvedValue(undefined);
  conn.commit.mockResolvedValue(undefined);
  conn.rollback.mockResolvedValue(undefined);
  conn.release.mockImplementation(() => {});
  invoiceRepository.findAppointmentForUpdate.mockResolvedValue(completedAppointment);
  invoiceRepository.findByAppointmentId.mockResolvedValue(null);
  invoiceRepository.findAppointmentServicesForUpdate.mockResolvedValue(serviceLines);
  invoiceRepository.sumAppointmentServices.mockResolvedValue('300.30');
  invoiceRepository.createInvoice.mockResolvedValue(81);
  invoiceRepository.createInvoiceDetails.mockResolvedValue(undefined);
  invoiceRepository.findById.mockResolvedValue({
    id: 81,
    invoice_code: 'INV-TEST',
    total_amount: '300.30',
  });
  invoiceRepository.findDetailsByInvoiceId.mockResolvedValue([]);
  logRepository.insert.mockResolvedValue(undefined);
};

describe('invoice service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    conn.beginTransaction.mockReset();
    conn.commit.mockReset();
    conn.rollback.mockReset();
    conn.release.mockReset();
    Object.values(invoiceRepository).forEach((mock) => mock.mockReset());
    employeeRepository.findByUserId.mockReset();
    logRepository.insert.mockReset();
    prepareCreateMocks();
  });

  test('creates an invoice using booking-time DECIMAL values in one transaction', async () => {
    const result = await createForAppointment(admin, '10', {}, { user: admin });

    expect(result.invoice.total_amount).toBe('300.30');
    expect(invoiceRepository.createInvoice).toHaveBeenCalledWith(
      conn,
      expect.objectContaining({
        appointment_id: 10,
        customer_id: 3,
        created_by: 1,
        subtotal: '300.30',
        total_amount: '300.30',
        notes: null,
      })
    );
    expect(invoiceRepository.createInvoiceDetails).toHaveBeenCalledWith(conn, 81, serviceLines);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('refuses to create invoice unless the appointment is completed', async () => {
    invoiceRepository.findAppointmentForUpdate.mockResolvedValue({
      ...completedAppointment,
      status: 'in_progress',
    });

    await expect(createForAppointment(admin, '10')).rejects.toMatchObject({ statusCode: 409 });
    expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('refuses client-supplied totals instead of trusting them', async () => {
    await expect(
      createForAppointment(admin, '10', { total_amount: 1, discount_amount: 0 })
    ).rejects.toHaveProperty('name', 'ZodError');

    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
  });

  test('does not allow customers to create invoices', async () => {
    await expect(createForAppointment(customer, '10')).rejects.toMatchObject({ statusCode: 403 });

    expect(pool.getConnection).not.toHaveBeenCalled();
    expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
  });

  test('refuses a second invoice for the same appointment', async () => {
    invoiceRepository.findByAppointmentId.mockResolvedValue({ id: 80 });

    await expect(createForAppointment(admin, '10')).rejects.toMatchObject({ statusCode: 409 });
    expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('limits staff invoice creation to their assigned appointment', async () => {
    invoiceRepository.findEmployeeUserId.mockResolvedValue(99);

    await expect(createForAppointment(staff, '10')).rejects.toMatchObject({ statusCode: 403 });
    expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('allows assigned staff to create the invoice', async () => {
    invoiceRepository.findEmployeeUserId.mockResolvedValue(staff.id);

    await expect(createForAppointment(staff, '10')).resolves.toHaveProperty('invoice.id', 81);
    expect(invoiceRepository.createInvoice).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['no service lines', [], '0.00'],
    ['invalid booking price', [{ ...serviceLines[0], price_at_booking: 'not-money' }], '100.10'],
    ['zero total', [{ ...serviceLines[0], price_at_booking: '0.00' }], '0.00'],
  ])('rolls back for %s', async (_label, lines, subtotal) => {
    invoiceRepository.findAppointmentServicesForUpdate.mockResolvedValue(lines);
    invoiceRepository.sumAppointmentServices.mockResolvedValue(subtotal);

    await expect(createForAppointment(admin, '10')).rejects.toMatchObject({ statusCode: 422 });
    expect(invoiceRepository.createInvoice).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('rolls back invoice and detail creation when a detail insert fails', async () => {
    invoiceRepository.createInvoiceDetails.mockRejectedValue(new Error('detail insert failed'));

    await expect(createForAppointment(admin, '10')).rejects.toThrow('detail insert failed');
    expect(invoiceRepository.createInvoice).toHaveBeenCalledTimes(1);
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('only returns a customer invoice when it belongs to that customer', async () => {
    invoiceRepository.findById.mockResolvedValue({
      id: 81,
      customer_id: 44,
      employee_id: 20,
    });

    await expect(getInvoiceById(customer, '81')).rejects.toMatchObject({ statusCode: 404 });
    expect(invoiceRepository.findDetailsByInvoiceId).not.toHaveBeenCalled();
    expect(invoiceRepository.findPaymentsByInvoiceId).not.toHaveBeenCalled();
  });

  test('does not expose an invoice to a staff member assigned to another employee', async () => {
    invoiceRepository.findById.mockResolvedValue({
      id: 81,
      customer_id: customer.id,
      employee_id: 20,
    });
    employeeRepository.findByUserId.mockResolvedValue({ id: 21 });

    await expect(getInvoiceById(staff, '81')).rejects.toMatchObject({ statusCode: 404 });
    expect(invoiceRepository.findDetailsByInvoiceId).not.toHaveBeenCalled();
    expect(invoiceRepository.findPaymentsByInvoiceId).not.toHaveBeenCalled();
  });

  test('allows customer to read own invoice with details and payment history', async () => {
    invoiceRepository.findById.mockResolvedValue({
      id: 81,
      customer_id: customer.id,
      employee_id: 20,
    });
    invoiceRepository.findDetailsByInvoiceId.mockResolvedValue([{ item_name: 'Bath' }]);
    invoiceRepository.findPaymentsByInvoiceId.mockResolvedValue([]);

    const result = await getInvoiceById(customer, '81');

    expect(result.invoice.details).toEqual([{ item_name: 'Bath' }]);
    expect(result.invoice.payments).toEqual([]);
  });

  test('staff invoice listing is scoped to the current employee assignment', async () => {
    employeeRepository.findByUserId.mockResolvedValue({ id: 20 });
    invoiceRepository.list.mockResolvedValue({ rows: [], total: 0 });

    await listInvoices(staff, { page: '2', limit: '5' });

    expect(invoiceRepository.list).toHaveBeenCalledWith({
      role: 'staff',
      userId: staff.id,
      employeeId: 20,
      limit: 5,
      offset: 5,
    });
  });
});
