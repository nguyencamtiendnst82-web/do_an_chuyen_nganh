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

export { listUsers, createEmployee, updateUser, updateUserStatus };
export default { listUsers, createEmployee, updateUser, updateUserStatus };
