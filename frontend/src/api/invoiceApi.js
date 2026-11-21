import axiosClient from './axiosClient';

export const invoiceApi = {
  createForAppointment: (appointmentId, data) =>
    axiosClient.post(`/appointments/${appointmentId}/invoice`, data),
  listInvoices: (params) =>
    axiosClient.get('/invoices', { params }),
  getInvoice: (id) =>
    axiosClient.get(`/invoices/${id}`),
  recordPayment: (id, data) =>
    axiosClient.post(`/invoices/${id}/payments`, data),
  previewInvoice: (appointmentId) =>
    axiosClient.get(`/appointments/${appointmentId}/invoice-preview`),
  decideDiscount: (id, approve) =>
    axiosClient.patch(`/invoices/${id}/discount-approval`, { approve }),
  getVietQR: (id) =>
    axiosClient.get(`/invoices/${id}/vietqr`),
};

export default invoiceApi;

