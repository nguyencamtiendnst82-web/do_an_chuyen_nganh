import axiosClient from './axiosClient';

export const employeeApi = {
  listEmployees: (params) => axiosClient.get('/employees', { params }),
  getEmployee: (id) => axiosClient.get(`/employees/${id}`),
  updateEmployee: (id, data) => axiosClient.put(`/employees/${id}`, data),
};

export default employeeApi;

