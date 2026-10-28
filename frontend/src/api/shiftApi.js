import axiosClient from './axiosClient';

export const shiftApi = {
  listShifts: (params) => axiosClient.get('/shifts', { params }),
  createShift: (data) => axiosClient.post('/shifts', data),
  updateShift: (id, data) => axiosClient.put(`/shifts/${id}`, data),
  deleteShift: (id) => axiosClient.delete(`/shifts/${id}`),

  listEmployeeShifts: (params) => axiosClient.get('/employee-shifts', { params }),
  bulkAssign: (data) => axiosClient.post('/employee-shifts/bulk', data),
  getMyShifts: (params) => axiosClient.get('/employee-shifts/me', { params }),
  deleteEmployeeShift: (id) => axiosClient.delete(`/employee-shifts/${id}`),
};

export default shiftApi;

