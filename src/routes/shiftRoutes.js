import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { list, getOne, create, update, remove } from '../controllers/shiftController.js';

const router = express.Router();

// Tất cả người dùng đã đăng nhập đều có thể xem ca làm việc
router.use(authenticate);
router.get('/', list);
router.get('/:id', getOne);

// Chỉ Admin mới có quyền tạo, sửa, xóa ca làm việc
router.post('/', authorize('admin'), create);
router.put('/:id', authorize('admin'), update);
router.delete('/:id', authorize('admin'), remove);

export default router;

