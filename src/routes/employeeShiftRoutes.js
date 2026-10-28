import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { bulkAssign, list, getMe, remove } from '../controllers/employeeShiftController.js';

const router = express.Router();

router.use(authenticate);

// GET /api/employee-shifts/me - Nhân viên xem lịch ca của chính mình
router.get('/me', authorize('staff', 'admin'), getMe);

// Các endpoint dưới đây chỉ dành riêng cho Admin
router.post('/bulk', authorize('admin'), bulkAssign);
router.get('/', authorize('admin'), list);
router.delete('/:id', authorize('admin'), remove);

export default router;

