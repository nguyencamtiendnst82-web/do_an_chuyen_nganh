import express from 'express';
import rateLimit from 'express-rate-limit';
const router = express.Router();

import authenticate from '../middlewares/authenticate.js';
import { uploadAvatarImage, AVATAR_DIR } from '../middlewares/uploadImage.js';
import { verifyEmail, resendVerification } from '../controllers/emailVerificationController.js';
import { register, login, logout, getMe, updateMe, changePassword, uploadAvatar, removeAvatar } from '../controllers/authController.js';

// Rate limit cho đăng nhập: 10 lần / 15 phút / IP
// Khi chạy Jest (NODE_ENV=test) thì bỏ qua để bộ test không chạm trần giới hạn.
// Muốn thử riêng chức năng giới hạn trong test: đặt FORCE_RATE_LIMIT=true.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
  skipSuccessfulRequests: false,
  skip: () =>
    process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true',
});

// Rate limit đăng ký: 20 lần / giờ / IP (chống tạo tài khoản hàng loạt, dò email/SĐT đã tồn tại)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Bạn đăng ký quá nhiều lần. Vui lòng thử lại sau.',
  },
  skip: () =>
    process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true',
});

// Rate limit xác minh email: bấm link 30 lần / 15 phút / IP; gửi lại thư 3 lần / giờ / tài khoản
const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn thử quá nhiều lần. Vui lòng thử lại sau.' },
  skip: () =>
    process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true',
});

const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user-${req.user.id}`,
  message: { success: false, message: 'Bạn yêu cầu gửi lại thư quá nhiều lần. Vui lòng thử lại sau 1 giờ.' },
  skip: () =>
    process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true',
});

// Rate limit đổi mật khẩu: tối đa 5 lần THẤT BẠI / 15 phút / tài khoản
// (chống kẻ cầm được token tìm mật khẩu cũ bằng cách thử liên tục).
// Các lần đổi thành công không bị tính. Bỏ qua khi chạy Jest, giống loginLimiter.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user-${req.user.id}`,
  message: {
    success: false,
    message: 'Bạn đã thử đổi mật khẩu sai quá nhiều lần. Vui lòng thử lại sau 15 phút.',
  },
  skipSuccessfulRequests: true,
  skip: () =>
    process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true',
});

// GET /api/auth/avatars/<tên-file> – Phục vụ ảnh đại diện (công khai, chỉ đọc)
// Đi qua tiền tố /api nên proxy của Vite và tunnel đều dùng được, không cần cấu hình thêm.
router.use(
  '/avatars',
  express.static(AVATAR_DIR, {
    index: false,
    dotfiles: 'ignore',
    maxAge: '7d',
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  })
);

// POST /api/auth/register
router.post('/register', registerLimiter, register);

// POST /api/auth/login (có rate limit)
router.post('/login', loginLimiter, login);

// GET /api/auth/verify-email?token=... – Link trong thư xác minh email (công khai, trả trang HTML)
router.get('/verify-email', verifyEmailLimiter, verifyEmail);

// POST /api/auth/resend-verification – Gửi lại thư xác minh (cần đăng nhập)
router.post('/resend-verification', authenticate, resendVerificationLimiter, resendVerification);

// POST /api/auth/logout (yêu cầu đăng nhập)
router.post('/logout', authenticate, logout);

// GET /api/auth/me – Xem hồ sơ cá nhân (mọi role)
router.get('/me', authenticate, getMe);

// PUT /api/auth/me – Cập nhật hồ sơ cá nhân (mọi role)
router.put('/me', authenticate, updateMe);

// POST /api/auth/me/avatar – Tải ảnh đại diện lên (form-data, field "avatar")
router.post('/me/avatar', authenticate, uploadAvatarImage, uploadAvatar);

// DELETE /api/auth/me/avatar – Gỡ ảnh đại diện
router.delete('/me/avatar', authenticate, removeAvatar);

// POST /api/auth/change-password (mọi role)
router.post('/change-password', authenticate, changePasswordLimiter, changePassword);

export default router;