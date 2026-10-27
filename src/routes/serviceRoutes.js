import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import { serviceImages } from '../middlewares/uploadMedia.js';
import {
  list, getOne, create, update, setActive, uploadImage, removeImage,
} from '../controllers/spaServiceController.js';

const router = express.Router();

// Ảnh dịch vụ phục vụ công khai (hiển thị được cả ở trang chủ / thẻ <img>)
router.use('/images', serviceImages.serve());

// Mọi vai trò đã đăng nhập đều xem được (khách chỉ thấy dịch vụ đang bật)
router.use(authenticate);
router.get('/', list);
router.get('/:id', getOne);

// Chỉ admin được thêm / sửa / bật-tắt / đổi ảnh
router.post('/', authorize('admin'), create);
router.put('/:id', authorize('admin'), update);
router.patch('/:id/active', authorize('admin'), setActive);
router.post('/:id/image', authorize('admin'), serviceImages.receive('image'), uploadImage);
router.delete('/:id/image', authorize('admin'), removeImage);

export default router;
