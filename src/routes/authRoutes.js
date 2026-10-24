const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authenticate = require('../middlewares/authenticate');
const {
  register,
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
} = require('../controllers/authController');

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

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login (có rate limit)
router.post('/login', loginLimiter, login);

// POST /api/auth/logout (yêu cầu đăng nhập)
router.post('/logout', authenticate, logout);

// GET /api/auth/me – Xem hồ sơ cá nhân (mọi role)
router.get('/me', authenticate, getMe);

// PUT /api/auth/me – Cập nhật hồ sơ cá nhân (mọi role)
router.put('/me', authenticate, updateMe);

// POST /api/auth/change-password (mọi role)
router.post('/change-password', authenticate, changePassword);

module.exports = router;
