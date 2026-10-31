import express from 'express';
import authenticate from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/roles.js';
import { careImages } from '../middlewares/uploadCare.js';
import {
  checkIn,
  start,
  complete,
  petCareHistory,
  createIncident,
  listIncidents,
  getIncident,
  updateIncident,
} from '../controllers/operationsController.js';

/**
 * Vận hành tại quầy (gắn thẳng vào /api, đường dẫn đầy đủ nằm ở từng route):
 *  - PATCH /appointments/:id/check-in | start | complete   (staff/admin, staff chỉ lịch của mình)
 *  - GET   /pets/:petId/care-history                       (khách xem thú của mình; staff/admin xem tất cả)
 *  - /incidents                                            (staff/admin tạo & xem; admin cập nhật)
 *  - GET   /care-photos/:file                              (ảnh công khai, tên file là UUID)
 * Không dùng router.use(authenticate) để không ảnh hưởng các đường dẫn khác.
 */
const router = express.Router();

router.use('/care-photos', careImages.serve());

router.patch(
  '/appointments/:id/check-in',
  authenticate,
  authorize('staff', 'admin'),
  careImages.receive('photo_before'),
  checkIn
);
router.patch('/appointments/:id/start', authenticate, authorize('staff', 'admin'), start);
router.patch(
  '/appointments/:id/complete',
  authenticate,
  authorize('staff', 'admin'),
  careImages.receive('photo_after'),
  complete
);

router.get('/pets/:petId/care-history', authenticate, petCareHistory);

router.post('/incidents', authenticate, authorize('staff', 'admin'), createIncident);
router.get('/incidents', authenticate, authorize('staff', 'admin'), listIncidents);
router.get('/incidents/:id', authenticate, authorize('staff', 'admin'), getIncident);
router.patch('/incidents/:id', authenticate, authorize('admin'), updateIncident);

export default router;
