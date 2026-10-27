import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { petPhotos } from '../middlewares/uploadMedia.js';
import { list, getOne, create, update, archive, uploadPhoto, removePhoto } from '../controllers/petController.js';

const router = express.Router();

// Ảnh thú cưng phục vụ công khai (thẻ <img> không gửi được token); tên file là UUID khó đoán
router.use('/photos', petPhotos.serve());

// Cả 3 vai trò đều dùng được; quyền sở hữu được kiểm tra trong petService
router.use(authenticate);
router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', archive);
router.post('/:id/photo', petPhotos.receive('photo'), uploadPhoto);
router.delete('/:id/photo', removePhoto);

export default router;
