import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import { lookup } from '../controllers/customerController.js';

const router = express.Router();

// Chỉ nhân viên / admin được tra cứu khách hàng
router.use(authenticate, authorize('staff', 'admin'));
router.get('/', lookup);

export default router;
