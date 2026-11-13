import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import {
  revenueReport,
  servicesReport,
  employeesReport,
  appointmentsReport,
  customersReport,
} from '../controllers/reportController.js';

const router = express.Router();

// Tất cả các báo cáo thống kê chỉ dành riêng cho Quản trị viên (admin)
router.use(authenticate, authorize('admin'));

router.get('/revenue', revenueReport);
router.get('/services', servicesReport);
router.get('/employees', employeesReport);
router.get('/appointments', appointmentsReport);
router.get('/customers', customersReport);

export default router;
