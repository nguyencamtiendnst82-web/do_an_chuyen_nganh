import dashboardService from '../services/dashboardService.js';
import { sendSuccess } from '../utils/response.js';

export const adminDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getAdminDashboard();
    return sendSuccess(res, 'Số liệu tổng quan Admin Dashboard.', data);
  } catch (err) {
    return next(err);
  }
};

export const staffDashboard = async (req, res, next) => {
  try {
    const data = await dashboardService.getStaffDashboard(req.user.id);
    return sendSuccess(res, 'Số liệu tổng quan Staff Dashboard.', data);
  } catch (err) {
    return next(err);
  }
};

export default {
  adminDashboard,
  staffDashboard,
};
