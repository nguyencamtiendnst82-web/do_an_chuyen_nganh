import express from 'express';
const router = express.Router();

import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { getUserDetail, listUsers, createEmployee, updateUser, updateUserStatus, resetPassword } from '../controllers/userController.js';

// Tất cả routes trong /api/users đều yêu cầu xác thực và quyền admin
router.use(authenticate);
router.use(authorize('admin'));

// GET  /api/users          – Danh sách users (phân trang, lọc, tìm kiếm)
router.get('/', listUsers);

// GET  /api/users/:id      – Xem chi tiết nhân viên/khách hàng (chỉ đọc)
router.get('/:id', getUserDetail);

// POST /api/users          – Tạo nhân viên mới (transaction: user + employee)
router.post('/', createEmployee);

// PUT  /api/users/:id      – Luôn 403: admin không sửa thông tin nhân viên/khách hàng (tự cập nhật ở Hồ sơ cá nhân)
router.put('/:id', updateUser);

// PATCH /api/users/:id/status – Thay đổi trạng thái (active/inactive/locked)
router.patch('/:id/status', updateUserStatus);

// POST /api/users/:id/reset-password – Luôn 403: admin không đặt lại mật khẩu nhân viên/khách hàng
router.post('/:id/reset-password', resetPassword);

export default router;
