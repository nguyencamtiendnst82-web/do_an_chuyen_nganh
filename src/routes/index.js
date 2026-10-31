import customerRoutes from './customerRoutes.js';
import serviceRoutes from './serviceRoutes.js';
import petRoutes from './petRoutes.js';
import express from 'express';
const router = express.Router();

import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import googleAuthRoutes from './googleAuthRoutes.js';


import employeeRoutes from './employeeRoutes.js';
import shiftRoutes from './shiftRoutes.js';
import employeeShiftRoutes from './employeeShiftRoutes.js';
import appointmentRoutes from './appointmentRoutes.js';
import operationsRoutes from './operationsRoutes.js'

// Gắn các routes phân hệ
router.use('/', healthRoutes);
router.use('/auth/google', googleAuthRoutes);
router.use('/auth', authRoutes);
router.use('/services', serviceRoutes);
router.use('/pets', petRoutes);
router.use('/users', userRoutes);
router.use('/customers', customerRoutes);
router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/employee-shifts', employeeShiftRoutes);
router.use('/appointments', appointmentRoutes);
router.use(operationsRoutes);

export default router;

