import dashboardRepository from '../repositories/dashboardRepository.js';

export const getAdminDashboard = async () => {
  return await dashboardRepository.getAdminDashboardData();
};

export const getStaffDashboard = async (userId) => {
  return await dashboardRepository.getStaffDashboardData(userId);
};

export default {
  getAdminDashboard,
  getStaffDashboard,
};
