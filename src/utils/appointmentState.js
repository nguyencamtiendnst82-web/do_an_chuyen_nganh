import { httpError } from './params.js';

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked_in',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

/**
 * Các bước chuyển đổi trạng thái hợp lệ trong hệ thống
 */
export const ALLOWED_TRANSITIONS = {
  [APPOINTMENT_STATUS.PENDING]: [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.CONFIRMED]: [APPOINTMENT_STATUS.CHECKED_IN, APPOINTMENT_STATUS.CANCELLED],
  [APPOINTMENT_STATUS.CHECKED_IN]: [APPOINTMENT_STATUS.IN_PROGRESS],
  [APPOINTMENT_STATUS.IN_PROGRESS]: [APPOINTMENT_STATUS.COMPLETED],
  [APPOINTMENT_STATUS.COMPLETED]: [], // Trạng thái kết thúc, không thể đổi
  [APPOINTMENT_STATUS.CANCELLED]: [], // Trạng thái kết thúc, không thể đổi
};

/**
 * Tên hiển thị tiếng Việt của các trạng thái
 */
export const STATUS_LABELS = {
  [APPOINTMENT_STATUS.PENDING]: 'Chờ xác nhận',
  [APPOINTMENT_STATUS.CONFIRMED]: 'Đã xác nhận',
  [APPOINTMENT_STATUS.CHECKED_IN]: 'Đã tiếp nhận',
  [APPOINTMENT_STATUS.IN_PROGRESS]: 'Đang phục vụ',
  [APPOINTMENT_STATUS.COMPLETED]: 'Đã hoàn tất',
  [APPOINTMENT_STATUS.CANCELLED]: 'Đã hủy',
};

/**
 * Kiểm tra việc chuyển trạng thái có hợp lệ hay không
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {boolean}
 */
export const isValidTransition = (currentStatus, nextStatus) => {
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  return allowedNext.includes(nextStatus);
};

/**
 * Xác thực việc chuyển trạng thái, nếu sai sẽ ném lỗi 422 hoặc 409
 * @param {string} currentStatus
 * @param {string} nextStatus
 */
export const validateTransition = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) {
    return;
  }

  if (currentStatus === APPOINTMENT_STATUS.COMPLETED) {
    throw httpError(409, 'Lịch hẹn đã hoàn thành, không thể thay đổi trạng thái.');
  }

  if (currentStatus === APPOINTMENT_STATUS.CANCELLED) {
    throw httpError(409, 'Lịch hẹn đã bị hủy, không thể thay đổi trạng thái.');
  }

  if (!isValidTransition(currentStatus, nextStatus)) {
    const fromLabel = STATUS_LABELS[currentStatus] || currentStatus;
    const toLabel = STATUS_LABELS[nextStatus] || nextStatus;
    throw httpError(
      422,
      `Không thể chuyển trạng thái từ "${fromLabel}" sang "${toLabel}". Vui lòng tuân thủ quy trình vận hành.`
    );
  }
};

/**
 * Kiểm tra điều kiện hủy lịch đối với khách hàng:
 * 1. Trạng thái phải là pending hoặc confirmed.
 * 2. Phải trước giờ hẹn tối thiểu 2 giờ (so với thời điểm hiện tại).
 * 3. Bắt buộc có lý do hủy (3–500 ký tự).
 *
 * @param {object} appointment - { appointment_date, start_time, status }
 * @param {string} role - Vai trò của người thực hiện ('customer', 'staff', 'admin')
 * @param {string} reason - Lý do hủy
 * @param {Date} [now] - Thời điểm hiện tại (mặc định new Date())
 */
export const validateCancellation = (appointment, role, reason, now = new Date()) => {
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 500) {
    throw httpError(422, 'Lý do hủy lịch là bắt buộc và phải từ 3 đến 500 ký tự.');
  }

  if (
    appointment.status !== APPOINTMENT_STATUS.PENDING &&
    appointment.status !== APPOINTMENT_STATUS.CONFIRMED
  ) {
    throw httpError(
      409,
      `Không thể hủy lịch hẹn đang ở trạng thái "${STATUS_LABELS[appointment.status] || appointment.status}".`
    );
  }

  // Khách hàng: kiểm tra quy tắc trước giờ hẹn tối thiểu 2 giờ
  if (role === 'customer') {
    const d = appointment.appointment_date;
    const dateStr = typeof d === 'string'
    ? d.slice(0, 10)
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeStr = appointment.start_time.slice(0, 5);

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    const appointmentDateTime = new Date(year, month - 1, day, hours, minutes, 0);

    const diffMs = appointmentDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 2) {
      throw httpError(
        403,
        'Khách hàng chỉ có thể hủy lịch hẹn trước giờ hẹn tối thiểu 2 giờ. Vui lòng liên hệ trực tiếp spa để được hỗ trợ.'
      );
    }
  }
};

export default {
  APPOINTMENT_STATUS,
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  isValidTransition,
  validateTransition,
  validateCancellation,
};

