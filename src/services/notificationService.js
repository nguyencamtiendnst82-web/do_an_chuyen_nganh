import notificationRepository from '../repositories/notificationRepository.js';
import { httpError, parseId } from '../utils/params.js';

export const NOTIFICATION_TYPES = [
  'appointment_created',
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_assigned',
  'appointment_checked_in',
  'appointment_started',
  'appointment_completed',
  'new_invoice',
  'payment_received',
  'incident_reported',
  'incident_resolved',
];

const fmtDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split('-').reverse().join('/') : d);
const fmtTime = (t) => (typeof t === 'string' ? t.slice(0, 5) : t);
const when = (a) => `${fmtTime(a.start_time)} ${fmtDate(a.appointment_date)}`;
const money = (v) => `${Number(v).toLocaleString('vi-VN')} đ`;

/**
 * Gửi thông báo CHO NHIỀU người. Luôn "best effort": lỗi thông báo không bao giờ làm hỏng
 * nghiệp vụ chính (lịch hẹn/hóa đơn đã lưu thành công rồi), chỉ ghi log lỗi.
 * Bỏ qua người trùng và người thực hiện (không tự báo cho chính mình).
 */
const send = async (recipientIds, type, payload, { excludeUserId } = {}) => {
  try {
    const ids = [...new Set(recipientIds.filter((id) => Number.isInteger(id) && id !== excludeUserId))];
    if (!ids.length) return;
    await notificationRepository.insertMany(ids.map((user_id) => ({ user_id, type, payload })));
  } catch (err) {
    console.error(`❌ [Notification] Không tạo được thông báo ${type}:`, err.message);
  }
};

const adminIds = async () => {
  try {
    return await notificationRepository.findActiveAdminIds();
  } catch (err) {
    console.error('❌ [Notification] Không lấy được danh sách admin:', err.message);
    return [];
  }
};

const apptBase = (a) => ({ appointment_id: a.id, appointment_code: a.appointment_code, link: 'appointments' });

/**
 * Sự kiện lịch hẹn. `appointment` là kết quả appointmentRepository.findById
 * (có customer_id, employee_user_id, pet_name, ngày giờ...). `actor` là người thao tác.
 */
export const notifyAppointment = async (event, appointment, actor) => {
  if (!appointment) return;
  const base = apptBase(appointment);
  const label = `${appointment.pet_name} – ${when(appointment)}`;
  const byCustomer = actor?.role_name === 'customer';
  const customerId = appointment.customer_id;
  const staffUserId = appointment.employee_user_id ?? null;

  switch (event) {
    case 'created':
      if (byCustomer) {
        await send([...(await adminIds()), staffUserId], 'appointment_created', {
          ...base, title: 'Lịch hẹn mới chờ xác nhận',
          message: `${appointment.customer_name} đặt lịch ${appointment.appointment_code} cho ${label}.`,
        }, { excludeUserId: actor.id });
      } else {
        await send([customerId], 'appointment_created', {
          ...base, title: 'Pet Spa đã đặt lịch giúp bạn',
          message: `Lịch ${appointment.appointment_code} cho ${label}.`,
        }, { excludeUserId: actor?.id });
      }
      break;
    case 'confirmed':
      await send([customerId], 'appointment_confirmed', {
        ...base, title: 'Lịch hẹn đã được xác nhận',
        message: `Lịch ${appointment.appointment_code} cho ${label} đã được xác nhận.`,
      }, { excludeUserId: actor?.id });
      break;
    case 'cancelled':
      if (byCustomer) {
        await send([...(await adminIds()), staffUserId], 'appointment_cancelled', {
          ...base, title: 'Khách đã hủy lịch hẹn',
          message: `${appointment.customer_name} hủy lịch ${appointment.appointment_code} (${label}).`,
        }, { excludeUserId: actor.id });
      } else {
        await send([customerId], 'appointment_cancelled', {
          ...base, title: 'Lịch hẹn đã bị hủy',
          message: `Lịch ${appointment.appointment_code} (${label}) đã bị hủy${
            appointment.cancellation_reason ? `: ${appointment.cancellation_reason}` : '.'}`,
        }, { excludeUserId: actor?.id });
      }
      break;
    case 'assigned':
      await send([staffUserId], 'appointment_assigned', {
        ...base, title: 'Bạn được phân công một lịch hẹn',
        message: `Lịch ${appointment.appointment_code} cho ${label}.`,
      }, { excludeUserId: actor?.id });
      break;
    case 'checked_in':
      await send([customerId], 'appointment_checked_in', {
        ...base, title: 'Pet Spa đã tiếp nhận bé',
        message: `${appointment.pet_name} đã được tiếp nhận tại quầy (lịch ${appointment.appointment_code}).`,
      }, { excludeUserId: actor?.id });
      break;
    case 'started':
      await send([customerId], 'appointment_started', {
        ...base, title: 'Bé đang được chăm sóc',
        message: `${appointment.pet_name} đã bắt đầu dịch vụ (lịch ${appointment.appointment_code}).`,
      }, { excludeUserId: actor?.id });
      break;
    case 'completed':
      await send([customerId], 'appointment_completed', {
        ...base, link: 'care-book', title: 'Bé đã làm đẹp xong',
        message: `${appointment.pet_name} đã hoàn tất dịch vụ (lịch ${appointment.appointment_code}). Xem sổ tay chăm sóc để biết lời khuyên.`,
      }, { excludeUserId: actor?.id });
      break;
    default:
  }
};

/** Hóa đơn mới / thanh toán: báo cho khách của lịch hẹn */
export const notifyInvoice = async (event, { customerId, invoiceId, invoiceCode, amount, paid }, actor) => {
  if (event === 'created') {
    await send([customerId], 'new_invoice', {
      invoice_id: invoiceId, invoice_code: invoiceCode, link: 'appointments',
      title: 'Bạn có hóa đơn mới',
      message: `Hóa đơn ${invoiceCode} – tổng ${money(amount)}.`,
    }, { excludeUserId: actor?.id });
  } else if (event === 'payment') {
    await send([customerId], 'payment_received', {
      invoice_id: invoiceId, invoice_code: invoiceCode, link: 'appointments',
      title: paid ? 'Thanh toán hoàn tất' : 'Đã ghi nhận thanh toán một phần',
      message: `Hóa đơn ${invoiceCode}: đã nhận ${money(amount)}.`,
    }, { excludeUserId: actor?.id });
  }
};

/** Sự cố: báo admin khi có sự cố mới; báo người báo cáo khi sự cố được xử lý xong */
export const notifyIncident = async (event, incident, actor) => {
  if (!incident) return;
  const base = { incident_id: incident.id, link: 'incidents' };
  if (event === 'reported') {
    await send(await adminIds(), 'incident_reported', {
      ...base, severity: incident.severity,
      title: `Sự cố mới (${incident.severity})`,
      message: `${incident.reporter_name} báo: ${incident.title} – bé ${incident.pet_name}.`,
    }, { excludeUserId: actor?.id });
  } else if (event === 'resolved') {
    await send([incident.reported_by], 'incident_resolved', {
      ...base, title: 'Sự cố đã được xử lý',
      message: `"${incident.title}" (bé ${incident.pet_name}) đã được xử lý.`,
    }, { excludeUserId: actor?.id });
  }
};

/** GET /api/notifications */
export const listNotifications = async (actor, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 15));
  const unreadOnly = query.unread === '1' || query.unread === 'true';
  const [rows, total, unread] = await Promise.all([
    notificationRepository.findByUser(actor.id, { unreadOnly, page, limit }),
    notificationRepository.countByUser(actor.id, unreadOnly),
    notificationRepository.countByUser(actor.id, true),
  ]);
  const notifications = rows.map((r) => ({
    ...r,
    is_read: Boolean(r.is_read),
    payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload,
  }));
  return {
    notifications,
    unread_count: unread,
    pagination: { total, page, limit, total_pages: Math.ceil(total / limit) || 1 },
  };
};

export const getUnreadCount = async (actor) => ({ unread_count: await notificationRepository.countByUser(actor.id, true) });

export const markRead = async (actor, rawId) => {
  const id = parseId(rawId, 'ID thông báo');
  if (!(await notificationRepository.markRead(id, actor.id))) throw httpError(404, 'Không tìm thấy thông báo.');
  return getUnreadCount(actor);
};

export const markAllRead = async (actor) => {
  await notificationRepository.markAllRead(actor.id);
  return { unread_count: 0 };
};

export default {
  notifyAppointment, notifyInvoice, notifyIncident,
  listNotifications, getUnreadCount, markRead, markAllRead,
};
