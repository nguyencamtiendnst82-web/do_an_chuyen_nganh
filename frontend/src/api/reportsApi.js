import axiosClient from './axiosClient';

/**
 * API báo cáo và thống kê (chỉ dành cho Admin)
 */
export const getRevenueReport = (params) =>
  axiosClient.get('/reports/revenue', { params });

export const getServicesReport = (params) =>
  axiosClient.get('/reports/services', { params });

export const getEmployeesReport = (params) =>
  axiosClient.get('/reports/employees', { params });

export const getAppointmentsReport = (params) =>
  axiosClient.get('/reports/appointments', { params });

export const getCustomersReport = (params) =>
  axiosClient.get('/reports/customers', { params });

/**
 * Tải file CSV từ các endpoint báo cáo
 */
export const exportReportCsv = (endpoint, params = {}) =>
  axiosClient.get(endpoint, {
    params: { ...params, format: 'csv' },
    responseType: 'blob',
  });

/**
 * API Nhật ký hệ thống (Admin)
 */
export const getSystemLogs = (params) =>
  axiosClient.get('/logs', { params });

/**
 * API Dashboard
 */
export const getAdminDashboard = () =>
  axiosClient.get('/dashboard/admin');

export const getStaffDashboard = () =>
  axiosClient.get('/dashboard/staff');

export default {
  getRevenueReport,
  getServicesReport,
  getEmployeesReport,
  getAppointmentsReport,
  getCustomersReport,
  exportReportCsv,
  getSystemLogs,
  getAdminDashboard,
  getStaffDashboard,
};
