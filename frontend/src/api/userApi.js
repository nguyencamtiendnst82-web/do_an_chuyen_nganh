import axiosClient from './axiosClient';

export const userApi = {
  listUsers: (params) => axiosClient.get('/users', { params }),
  createEmployee: (data) => axiosClient.post('/users', data),
  updateUser: (id, data) => axiosClient.put(`/users/${id}`, data),
  updateUserStatus: (id, status) => axiosClient.patch(`/users/${id}/status`, { status }),
  resetPassword: (id, password) => axiosClient.post(`/users/${id}/reset-password`, { password }),
};

export default userApi;

