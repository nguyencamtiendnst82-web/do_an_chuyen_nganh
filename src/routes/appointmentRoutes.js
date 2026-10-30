import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import {
  getAvailability,
  create,
  getOne,
  list,
  reschedule,
  cancel,
  assign,
  confirm,
  updateStatus,
} from '../controllers/appointmentController.js';

const router = express.Router();

router.use(authenticate);

// Tra cứu khung giờ trống (khách, nhân viên, admin)
router.get('/availability', getAvailability);

// Danh sách lịch hẹn và Đặt lịch hẹn mới
router.get('/', list);
router.post('/', create);

// Chi tiết lịch hẹn
router.get('/:id', getOne);

// Đổi lịch & Hủy lịch (khách hoặc nhân viên/admin)
router.patch('/:id/reschedule', reschedule);
router.patch('/:id/cancel', cancel);

// Các thao tác quản lý lịch hẹn (chỉ Staff và Admin)
router.patch('/:id/assign', authorize('staff', 'admin'), assign);
router.patch('/:id/confirm', authorize('staff', 'admin'), confirm);
router.patch('/:id/status', authorize('staff', 'admin'), updateStatus);

export default router;

