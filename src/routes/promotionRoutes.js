import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import { list, create, update, setActive } from '../controllers/promotionController.js';

const router = express.Router();

// Chỉ admin quản lý chương trình khuyến mãi
router.use(authenticate, authorize('admin'));
router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.patch('/:id/active', setActive);

export default router;
