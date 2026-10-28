import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { list, getOne, update } from '../controllers/employeeController.js';

const router = express.Router();

/**
 * Middleware gắn thông tin user nếu có gửi token hợp lệ, nếu không có token thì bỏ qua (cho khách xem)
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  return authenticate(req, res, next);
};

// GET /api/employees - Khách/nhân viên/admin xem (dùng ?scope=admin nếu là admin)
router.get('/', optionalAuth, list);

// GET /api/employees/:id - Khách xem công khai, admin xem đầy đủ
router.get('/:id', optionalAuth, getOne);

// PUT /api/employees/:id - Admin sửa thông tin nhân sự
router.put('/:id', authenticate, authorize('admin'), update);

export default router;

