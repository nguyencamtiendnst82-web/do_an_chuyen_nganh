const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * POST /api/auth/register
 * Tạo tài khoản mới (chỉ customer)
 */
const register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body, req);
    return sendSuccess(res, 'Đăng ký tài khoản thành công.', { user }, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * Đăng nhập bằng email hoặc phone
 */
const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body, req);
    return sendSuccess(res, 'Đăng nhập thành công.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Ghi log đăng xuất (client tự xóa token)
 */
const logout = async (req, res, next) => {
  try {
    await authService.logout(req);
    return sendSuccess(res, 'Đăng xuất thành công.');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Xem thông tin hồ sơ cá nhân
 */
const getMe = async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.id);
    return sendSuccess(res, 'Lấy thông tin hồ sơ thành công.', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/auth/me
 * Cập nhật hồ sơ cá nhân
 */
const updateMe = async (req, res, next) => {
  try {
    const user = await authService.updateMe(req.user.id, req.body, req);
    return sendSuccess(res, 'Cập nhật hồ sơ thành công.', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/me/avatar
 * Tải ảnh đại diện lên
 */
const uploadAvatar = async (req, res, next) => {
  try {
    const user = await authService.uploadAvatar(req.user.id, req.file, req);
    return sendSuccess(res, 'Cập nhật ảnh đại diện thành công.', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/auth/me/avatar
 * Gỡ ảnh đại diện
 */
const removeAvatar = async (req, res, next) => {
  try {
    const user = await authService.removeAvatar(req.user.id, req);
    return sendSuccess(res, 'Đã gỡ ảnh đại diện.', { user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/change-password
 * Đổi mật khẩu (yêu cầu mật khẩu cũ)
 */
const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user.id, req.body, req);
    return sendSuccess(res, 'Đổi mật khẩu thành công.');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateMe,
  uploadAvatar,
  removeAvatar,
  changePassword,
};