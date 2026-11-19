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
// Admin chỉ xem lịch hẹn (như chủ cửa hàng), không tạo/sửa/hủy; khách và nhân viên được đặt lịch
router.post('/', authorize('customer', 'staff'), create);

// Chi tiết lịch hẹn
router.get('/:id', getOne);

// Đổi lịch & Hủy lịch (khách hoặc nhân viên; admin chỉ xem)
router.patch('/:id/reschedule', authorize('customer', 'staff'), reschedule);
router.patch('/:id/cancel', authorize('customer', 'staff'), cancel);

// Các thao tác điều hành lịch hẹn (chỉ Staff; Admin không can thiệp)
router.patch('/:id/assign', authorize('staff'), assign);
router.patch('/:id/confirm', authorize('staff'), confirm);
router.patch('/:id/status', authorize('staff'), updateStatus);

export default router;

