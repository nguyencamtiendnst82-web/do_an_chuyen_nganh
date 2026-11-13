import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import { logsReport } from '../controllers/reportController.js';

const router = express.Router();

// Nhật ký kiểm toán hệ thống (system_logs): chỉ Quản trị viên (admin)
router.use(authenticate, authorize('admin'));

router.get('/', logsReport);

export default router;
