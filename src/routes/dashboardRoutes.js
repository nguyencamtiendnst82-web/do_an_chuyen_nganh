import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import { adminDashboard, staffDashboard } from '../controllers/dashboardController.js';

const router = express.Router();

router.use(authenticate);

// Admin dashboard: chỉ admin
router.get('/admin', authorize('admin'), adminDashboard);

// Staff dashboard: nhân viên (staff) xem thống kê của mình
router.get('/staff', authorize('staff', 'admin'), staffDashboard);

export default router;
