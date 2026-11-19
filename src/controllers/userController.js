import userService from '../services/userService.js';
import { sendSuccess } from '../utils/response.js';

/**
 * GET /api/users
 * Lấy danh sách users (phân trang, lọc, tìm kiếm) – Admin only
 */
const listUsers = async (req, res, next) => {
  try {
    const result = await userService.listUsers(req.query);
    return sendSuccess(res, 'Lấy danh sách người dùng thành công.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/users/:id
 * Xem chi tiết nhân viên / khách hàng (chỉ đọc) – Admin only
 */
const getUserDetail = async (req, res, next) => {
  try {
    const result = await userService.getUserDetail(req.params.id);
    return sendSuccess(res, 'Lấy chi tiết tài khoản thành công.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users
 * Tạo tài khoản nhân viên mới (user role=staff + employee) – Admin only
 */
const createEmployee = async (req, res, next) => {
  try {
    const result = await userService.createEmployee(req.body, req);
    return sendSuccess(res, 'Tạo tài khoản nhân viên thành công.', result, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/users/:id
 * Cập nhật thông tin user – Admin only
 * KHÔNG cho đổi role_id, email, password_hash
 */
const updateUser = async (req, res, next) => {
  try {
    const result = await userService.updateUser(req.params.id, req.body, req);
    return sendSuccess(res, 'Cập nhật thông tin người dùng thành công.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/users/:id/status
 * Thay đổi trạng thái tài khoản – Admin only
 * Không cho admin tự khóa chính mình
 */
const updateUserStatus = async (req, res, next) => {
  try {
    const user = await userService.updateUserStatus(req.params.id, req.body, req);
    return sendSuccess(res, 'Cập nhật trạng thái tài khoản thành công.', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/users/:id/reset-password
 * Admin đặt lại mật khẩu cho user
 */
const resetPassword = async (req, res, next) => {
  try {
    const result = await userService.resetPassword(req.params.id, req.body, req);
    return sendSuccess(res, result.message);
  } catch (err) {
    next(err);
  }
};

export { getUserDetail, listUsers, createEmployee, updateUser, updateUserStatus, resetPassword };
export default { getUserDetail, listUsers, createEmployee, updateUser, updateUserStatus, resetPassword };
