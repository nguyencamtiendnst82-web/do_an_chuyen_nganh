import customerRoutes from './customerRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import petRoutes from './petRoutes.js';
import express from 'express';
const router = express.Router();

import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import googleAuthRoutes from './googleAuthRoutes.js';


// Gắn các routes phân hệ
router.use('/', healthRoutes);
router.use('/auth/google', googleAuthRoutes);
router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/pets', petRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);

export default router;

