import express from 'express';
const router = express.Router();

import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';

// Gắn các routes phân hệ
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);

export default router;

