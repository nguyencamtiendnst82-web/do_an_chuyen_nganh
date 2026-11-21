import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import {
  getAvailability,
  getOpenDates,
  create,
  getOne,
  list,
  reschedule,
  cancel,
  assign,
  confirm,
  updateStatus,
} from '../controllers/appointmentController.js';
import {
  create as createChangeRequest,
  list as listChangeRequests,
  respond as respondChangeRequest,
} from '../controllers/changeRequestController.js';

const router = express.Router();

router.use(authenticate);

// Tra cứu khung giờ trống (khách, nhân viên, admin)
router.get('/availability', getAvailability);
// Các ngày spa đã mở lịch (đã xếp ca) để khách chọn
router.get('/open-dates', getOpenDates);

// Danh sách lịch hẹn và Đặt lịch hẹn mới
router.get('/', list);
// Chỉ khách tự đặt lịch (trực tuyến hoặc ngay tại quầy bằng tài khoản của mình); nhân viên/admin không đặt hộ
router.post('/', authorize('customer'), create);

// Chi tiết lịch hẹn
router.get('/:id', getOne);

// Đổi lịch & Hủy lịch (khách hoặc nhân viên; admin chỉ xem)
router.patch('/:id/reschedule', authorize('customer', 'staff'), reschedule);
router.patch('/:id/cancel', authorize('customer', 'staff'), cancel);

// Các thao tác điều hành lịch hẹn (chỉ Staff; Admin không can thiệp)
router.patch('/:id/assign', authorize('staff'), assign);
router.patch('/:id/confirm', authorize('staff'), confirm);
router.patch('/:id/status', authorize('staff'), updateStatus);

// Đề xuất chuyển nhân viên / dời lịch: nhân viên phụ trách đề xuất, khách đồng ý hoặc từ chối
router.post('/:id/change-requests', authorize('staff'), createChangeRequest);
router.get('/:id/change-requests', listChangeRequests);
router.patch('/change-requests/:id/respond', authorize('customer'), respondChangeRequest);

export default router;

