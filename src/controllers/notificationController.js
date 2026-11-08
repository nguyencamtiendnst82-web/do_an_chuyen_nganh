import notificationService from '../services/notificationService.js';
import { sendSuccess } from '../utils/response.js';

const wrap = (fn, message) => async (req, res, next) => {
  try {
    return sendSuccess(res, message, await fn(req));
  } catch (err) {
    return next(err);
  }
};

export const list = wrap((req) => notificationService.listNotifications(req.user, req.query), 'Lấy danh sách thông báo thành công.');
export const unreadCount = wrap((req) => notificationService.getUnreadCount(req.user), 'Lấy số thông báo chưa đọc thành công.');
export const markRead = wrap((req) => notificationService.markRead(req.user, req.params.id), 'Đã đánh dấu đã đọc.');
export const markAllRead = wrap((req) => notificationService.markAllRead(req.user), 'Đã đánh dấu tất cả là đã đọc.');
