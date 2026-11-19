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

// PUT  /api/users/:id      – Cập nhật thông tin NHÂN VIÊN (khách hàng: 403; không đổi role_id, email, password_hash)
router.put('/:id', updateUser);

// PATCH /api/users/:id/status – Thay đổi trạng thái (active/inactive/locked)
router.patch('/:id/status', updateUserStatus);

// POST /api/users/:id/reset-password – Admin đặt lại mật khẩu cho NHÂN VIÊN (khách hàng: 403)
router.post('/:id/reset-password', resetPassword);

export default router;
