import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const notificationRepository = {
  insertMany: jest.fn(),
  findActiveAdminIds: jest.fn(),
};
jest.unstable_mockModule('../src/config/db.js', () => ({ pool: {} }));
jest.unstable_mockModule('../src/repositories/notificationRepository.js', () => ({
  default: notificationRepository,
}));

const { notifyAppointment, notifyInvoice } = await import('../src/services/notificationService.js');

const appt = {
  id: 7, appointment_code: 'APT-7', customer_id: 10, customer_name: 'Khách', employee_user_id: 20,
  pet_name: 'Bông', appointment_date: '2030-02-10', start_time: '09:00:00',
};

describe('notificationService (đơn vị)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationRepository.findActiveAdminIds.mockResolvedValue([1]);
  });

  test('U1. Lỗi DB khi tạo thông báo không ném ra ngoài (không làm hỏng nghiệp vụ chính)', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    notificationRepository.insertMany.mockRejectedValue(new Error('DB chết'));
    await expect(notifyAppointment('confirmed', appt, { id: 99, role_name: 'staff' })).resolves.toBeUndefined();
    await expect(notifyInvoice('created', { customerId: 10, invoiceId: 1, invoiceCode: 'INV', amount: 1 }, { id: 99 })).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  test('U2. Không tự báo cho người thực hiện và loại trùng người nhận', async () => {
    notificationRepository.insertMany.mockResolvedValue();
    // Admin id 1 vừa là actor vừa là admin; nhân viên phụ trách là 20
    await notifyAppointment('cancelled', appt, { id: 10, role_name: 'customer' });
    const rows = notificationRepository.insertMany.mock.calls[0][0];
    expect(rows.map((r) => r.user_id).sort()).toEqual([1, 20]);

    notificationRepository.insertMany.mockClear();
    await notifyAppointment('confirmed', appt, { id: 10, role_name: 'customer' });
    expect(notificationRepository.insertMany).not.toHaveBeenCalled();
  });

  test('U3. Nội dung thông báo định dạng ngày giờ kiểu Việt', async () => {
    notificationRepository.insertMany.mockResolvedValue();
    await notifyAppointment('confirmed', appt, { id: 99, role_name: 'staff' });
    const [row] = notificationRepository.insertMany.mock.calls[0][0];
    expect(row.type).toBe('appointment_confirmed');
    expect(row.payload.message).toContain('09:00 10/02/2030');
  });
});
