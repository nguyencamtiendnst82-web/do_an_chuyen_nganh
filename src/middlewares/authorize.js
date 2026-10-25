import { sendError } from '../utils/response.js';

/**
 * Middleware factory kiểm tra phân quyền theo role
 * Phải dùng SAU middleware authenticate
 *
 * @param {...string} roles - Danh sách các role được phép (vd: 'admin', 'staff')
 * @returns {Function} Express middleware
 *
 * @example
 * router.get('/users', authenticate, authorize('admin'), listUsers);
 * router.get('/appointments', authenticate, authorize('admin', 'staff'), listAppointments);
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      // Đề phòng trường hợp quên dùng authenticate trước
      return sendError(res, 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.', 401);
    }

    if (!roles.includes(req.user.role_name)) {
      return sendError(
        res,
        `Bạn không có quyền thực hiện thao tác này. Chỉ ${roles.join(', ')} mới được phép.`,
        403
      );
    }

    next();
  };
};

export default authorize;
