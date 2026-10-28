import express from 'express';
const router = express.Router();

import authenticate from '../middlewares/authenticate.js';
import authorize from '../middlewares/authorize.js';
import { listUsers, createEmployee, updateUser, updateUserStatus, resetPassword } from '../controllers/userController.js';

// Tất cả routes trong /api/users đều yêu cầu xác thực và quyền admin
router.use(authenticate);
router.use(authorize('admin'));

// GET  /api/users          – Danh sách users (phân trang, lọc, tìm kiếm)
router.get('/', listUsers);

// POST /api/users          – Tạo nhân viên mới (transaction: user + employee)
router.post('/', createEmployee);

// PUT  /api/users/:id      – Cập nhật thông tin user (không đổi role_id, email, password_hash)
router.put('/:id', updateUser);

// PATCH /api/users/:id/status – Thay đổi trạng thái (active/inactive/locked)
router.patch('/:id/status', updateUserStatus);

// POST /api/users/:id/reset-password – Admin đặt lại mật khẩu cho user
router.post('/:id/reset-password', resetPassword);

export default router;
