import {
  APPOINTMENT_STATUS,
  isValidTransition,
  validateTransition,
  validateCancellation,
} from '../src/utils/appointmentState.js';

describe('Kiểm thử máy trạng thái lịch hẹn (Appointment State Machine)', () => {
  describe('isValidTransition: Chuyển đổi trạng thái đúng luồng', () => {
    test('1. Luồng chính: pending -> confirmed -> checked_in -> in_progress -> completed', () => {
      expect(isValidTransition(APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CONFIRMED)).toBe(true);
      expect(isValidTransition(APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CHECKED_IN)).toBe(true);
      expect(isValidTransition(APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.IN_PROGRESS)).toBe(true);
      expect(isValidTransition(APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.COMPLETED)).toBe(true);
    });

    test('2. Hủy lịch hợp lệ: pending -> cancelled hoặc confirmed -> cancelled', () => {
      expect(isValidTransition(APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CANCELLED)).toBe(true);
      expect(isValidTransition(APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED)).toBe(true);
    });

    test('3. Nhảy cóc trạng thái sai thứ tự -> không hợp lệ (false)', () => {
      // pending nhảy thẳng lên checked_in hoặc completed
      expect(isValidTransition(APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.CHECKED_IN)).toBe(false);
      expect(isValidTransition(APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.COMPLETED)).toBe(false);
      // confirmed nhảy thẳng lên in_progress
      expect(isValidTransition(APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_PROGRESS)).toBe(false);
      // checked_in nhảy thẳng lên completed
      expect(isValidTransition(APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.COMPLETED)).toBe(false);
    });

    test('4. Quay ngược trạng thái -> không hợp lệ (false)', () => {
      expect(isValidTransition(APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.PENDING)).toBe(false);
      expect(isValidTransition(APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.IN_PROGRESS)).toBe(false);
    });

    test('5. Đã hoàn thành hoặc đã hủy thì không thể chuyển sang bất kỳ trạng thái nào khác', () => {
      expect(isValidTransition(APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED)).toBe(false);
      expect(isValidTransition(APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.PENDING)).toBe(false);
      expect(isValidTransition(APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.CONFIRMED)).toBe(false);
    });
  });

  describe('validateTransition: Ném lỗi đúng mã HTTP', () => {
    test('1. Chuyển sai quy trình ném 422', () => {
      expect(() => {
        validateTransition(APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.COMPLETED);
      }).toThrow();
      try {
        validateTransition(APPOINTMENT_STATUS.PENDING, APPOINTMENT_STATUS.COMPLETED);
      } catch (err) {
        expect(err.statusCode).toBe(422);
      }
    });

    test('2. Sửa lịch đã completed hoặc cancelled ném 409', () => {
      try {
        validateTransition(APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED);
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }

      try {
        validateTransition(APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.CONFIRMED);
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }
    });
  });

  describe('validateCancellation: Quy tắc hủy lịch', () => {
    const aptBase = {
      appointment_date: '2026-10-30',
      start_time: '14:00:00',
      status: APPOINTMENT_STATUS.CONFIRMED,
    };

    test('1. Không có lý do hủy hoặc lý do dưới 3 ký tự -> ném 422', () => {
      expect(() => {
        validateCancellation(aptBase, 'customer', '');
      }).toThrow();

      try {
        validateCancellation(aptBase, 'customer', 'ab');
      } catch (err) {
        expect(err.statusCode).toBe(422);
      }
    });

    test('2. Hủy lịch đang ở trạng thái in_progress hoặc completed -> ném 409', () => {
      const inProgressApt = { ...aptBase, status: APPOINTMENT_STATUS.IN_PROGRESS };
      try {
        validateCancellation(inProgressApt, 'staff', 'Bé bị sốt đột xuất');
      } catch (err) {
        expect(err.statusCode).toBe(409);
      }
    });

    test('3. Khách hủy trước giờ hẹn > 2 giờ -> hợp lệ', () => {
      // Giờ hẹn là 14:00 ngày 30/10/2026, thời điểm hiện tại là 10:00 cùng ngày (cách 4 giờ)
      const now = new Date(2026, 9, 30, 10, 0, 0);
      expect(() => {
        validateCancellation(aptBase, 'customer', 'Bận việc gia đình đột xuất', now);
      }).not.toThrow();
    });

    test('4. Khách hủy trước giờ hẹn < 2 giờ -> ném 403', () => {
      // Giờ hẹn 14:00, thời điểm hiện tại là 12:30 (cách 1.5 giờ)
      const now = new Date(2026, 9, 30, 12, 30, 0);
      try {
        validateCancellation(aptBase, 'customer', 'Bận việc gia đình đột xuất', now);
      } catch (err) {
        expect(err.statusCode).toBe(403);
        expect(err.message).toMatch(/tối thiểu 2 giờ/i);
      }
    });

    test('5. Nhân viên hoặc Admin hủy sát giờ (< 2 giờ) vẫn được phép', () => {
      const now = new Date(2026, 9, 30, 13, 30, 0); // Cách 30 phút
      expect(() => {
        validateCancellation(aptBase, 'staff', 'Nhân viên spa bị ốm đột xuất', now);
      }).not.toThrow();
      expect(() => {
        validateCancellation(aptBase, 'admin', 'Mất điện đột xuất tại cơ sở', now);
      }).not.toThrow();
    });
  });
});

