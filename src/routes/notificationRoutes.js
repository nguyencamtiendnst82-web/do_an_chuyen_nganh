import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { list, unreadCount, markRead, markAllRead } from '../controllers/notificationController.js';

const router = express.Router();

// Thông báo của chính người đăng nhập (mọi vai trò)
router.get('/', authenticate, list);
router.get('/unread-count', authenticate, unreadCount);
router.patch('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markRead);

export default router;
