import express from 'express';
import rateLimit from 'express-rate-limit';
import { googleLogin } from '../controllers/googleAuthController.js';

const router = express.Router();

// Giới hạn như đăng nhập thường (bỏ qua khi chạy Jest, giống loginLimiter)
const googleLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' },
  skip: () => process.env.NODE_ENV === 'test' && process.env.FORCE_RATE_LIMIT !== 'true',
});

// POST /api/auth/google  { credential }
router.post('/', googleLimiter, googleLogin);

export default router;
