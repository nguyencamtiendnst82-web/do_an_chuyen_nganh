import axiosClient from './axiosClient';

export const notificationApi = {
  list: (params) => axiosClient.get('/notifications', { params }),
  unreadCount: () => axiosClient.get('/notifications/unread-count'),
  markRead: (id) => axiosClient.patch(`/notifications/${id}/read`),
  markAllRead: () => axiosClient.patch('/notifications/read-all'),
};

export default notificationApi;
