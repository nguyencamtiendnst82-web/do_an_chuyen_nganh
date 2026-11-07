import passwordResetService from '../services/passwordResetService.js';
import { sendSuccess } from '../utils/response.js';

/**
 * POST /api/auth/forgot-password { email }
 * Luôn trả cùng một thông báo, không tiết lộ email có tồn tại hay không.
 * Việc gửi thư chạy nền: không chờ để thời gian phản hồi không lộ thông tin.
 */
const forgotPassword = async (req, res, next) => {
  try {
    await passwordResetService.requestPasswordReset(req.body, req);
    return sendSuccess(
      res,
      'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (cả mục Spam).'
    );
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/reset-password { token, new_password }
 */
const resetPassword = async (req, res, next) => {
  try {
    await passwordResetService.resetPassword(req.body, req);
    return sendSuccess(res, 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.');
  } catch (err) {
    return next(err);
  }
};

export { forgotPassword, resetPassword };
export default { forgotPassword, resetPassword };
