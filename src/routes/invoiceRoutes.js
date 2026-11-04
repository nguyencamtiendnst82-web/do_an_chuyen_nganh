import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import {
  createForAppointment,
  getOne,
  list,
  recordPayment,
  getVietQR,
} from '../controllers/invoiceController.js';

const router = express.Router();

// Lập hóa đơn cho lịch hẹn (Staff/Admin)
router.post(
  '/appointments/:appointmentId/invoice',
  authenticate,
  authorize('staff', 'admin'),
  createForAppointment
);

// Danh sách hóa đơn (Admin xem hết, Staff xem lịch của mình, Customer xem của mình)
router.get('/invoices', authenticate, authorize('admin', 'staff', 'customer'), list);

// Chi tiết hóa đơn
router.get('/invoices/:id', authenticate, authorize('admin', 'staff', 'customer'), getOne);

// Ghi nhận thanh toán mô phỏng (Staff/Admin)
router.post('/invoices/:id/payments', authenticate, authorize('staff', 'admin'), recordPayment);

// Lấy mã VietQR minh họa
router.get('/invoices/:id/vietqr', authenticate, authorize('admin', 'staff', 'customer'), getVietQR);

export default router;
