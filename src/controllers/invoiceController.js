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

const preview = async (req, res, next) => {
  try {
    const data = await invoiceService.previewInvoice(req.user, req.params.appointmentId);
    return sendSuccess(res, 'Xem trước hóa đơn thành công.', data);
  } catch (error) {
    return next(error);
  }
};

const decideDiscount = async (req, res, next) => {
  try {
    const data = await invoiceService.decideDiscount(req.user, req.params.id, req.body, req);
    return sendSuccess(res, req.body.approve ? 'Đã duyệt giảm giá.' : 'Đã từ chối giảm giá.', data);
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
  preview,
  decideDiscount,
  createForAppointment,
  list,
  getOne,
  recordPayment,
  getVietQR,
};

export default {
  preview,
  decideDiscount,
  createForAppointment,
  list,
  getOne,
  recordPayment,
  getVietQR,
};
