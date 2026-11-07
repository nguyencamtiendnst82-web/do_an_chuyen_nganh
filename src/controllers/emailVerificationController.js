import emailVerificationService from '../services/emailVerificationService.js';
import { sendSuccess } from '../utils/response.js';

const page = (title, message) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;background:#f6f7f9}
.box{background:#fff;padding:32px 28px;border-radius:12px;max-width:420px;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:center}
h1{font-size:20px;margin:0 0 12px}p{margin:0;color:#444;line-height:1.5}</style></head>
<body><div class="box"><h1>${title}</h1><p>${message}</p></div></body></html>`;

/**
 * GET /api/auth/verify-email?token=...
 * Người dùng bấm link trong thư → trả về trang HTML đơn giản (không cần frontend).
 */
const verifyEmail = async (req, res, next) => {
  try {
    await emailVerificationService.verifyEmail(req.query.token, req);
    return res
      .status(200)
      .type('html')
      .send(page('Xác minh email thành công', 'Email của bạn đã được xác minh. Bạn có thể đóng trang này và quay lại Pet Spa.'));
  } catch (err) {
    if (err.statusCode === 400) {
      return res
        .status(400)
        .type('html')
        .send(page('Liên kết không hợp lệ', 'Liên kết xác minh không hợp lệ hoặc đã hết hạn. Hãy đăng nhập và yêu cầu gửi lại thư xác minh.'));
    }
    return next(err);
  }
};

/**
 * POST /api/auth/resend-verification  (cần đăng nhập)
 */
const resendVerification = async (req, res, next) => {
  try {
    const result = await emailVerificationService.resendVerification(req.user, req);
    return sendSuccess(
      res,
      result.already_verified
        ? 'Email của bạn đã được xác minh.'
        : 'Đã gửi thư xác minh. Vui lòng kiểm tra hộp thư của bạn.',
      result
    );
  } catch (err) {
    return next(err);
  }
};

export { verifyEmail, resendVerification };
export default { verifyEmail, resendVerification };
