import invoiceService from '../services/invoiceService.js';
import { sendSuccess } from '../utils/response.js';

const createForAppointment = async (req, res, next) => {
  try {
    const data = await invoiceService.createForAppointment(
      req.user,
      req.params.appointmentId,
      req.body,
      req
    );
    return sendSuccess(res, 'Lập hóa đơn thành công.', data, 201);
  } catch (error) {
    return next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const data = await invoiceService.listInvoices(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách hóa đơn thành công.', data);
  } catch (error) {
    return next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await invoiceService.getInvoiceById(req.user, req.params.id);
    return sendSuccess(res, 'Lấy thông tin hóa đơn thành công.', data);
  } catch (error) {
    return next(error);
  }
};

const recordPayment = async (req, res, next) => {
  try {
    const data = await invoiceService.recordPayment(req.user, req.params.id, req.body, req);
    return sendSuccess(res, data.message, data, 201);
  } catch (error) {
    return next(error);
  }
};

const getVietQR = async (req, res, next) => {
  try {
    const data = await invoiceService.getVietQR(req.user, req.params.id);
    return sendSuccess(res, 'Lấy mã VietQR minh họa thành công.', data);
  } catch (error) {
    return next(error);
  }
};

export {
  createForAppointment,
  list,
  getOne,
  recordPayment,
  getVietQR,
};

export default {
  createForAppointment,
  list,
  getOne,
  recordPayment,
  getVietQR,
};
