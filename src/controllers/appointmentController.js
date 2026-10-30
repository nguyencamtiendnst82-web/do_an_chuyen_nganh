import appointmentService from '../services/appointmentService.js';
import { sendSuccess } from '../utils/response.js';

export const getAvailability = async (req, res, next) => {
  try {
    const data = await appointmentService.getAvailability(req.query);
    return sendSuccess(res, 'Tra cứu khung giờ trống thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const data = await appointmentService.createAppointment(req.user, req.body, req);
    return sendSuccess(res, 'Đặt lịch hẹn thành công.', data, 201);
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const data = await appointmentService.getAppointmentById(req.user, req.params.id);
    return sendSuccess(res, 'Lấy thông tin lịch hẹn thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const list = async (req, res, next) => {
  try {
    const data = await appointmentService.listAppointments(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách lịch hẹn thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const reschedule = async (req, res, next) => {
  try {
    const data = await appointmentService.rescheduleAppointment(
      req.user,
      req.params.id,
      req.body,
      req
    );
    return sendSuccess(res, 'Đổi lịch hẹn thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const cancel = async (req, res, next) => {
  try {
    const data = await appointmentService.cancelAppointment(
      req.user,
      req.params.id,
      req.body,
      req
    );
    return sendSuccess(res, 'Hủy lịch hẹn thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const assign = async (req, res, next) => {
  try {
    const data = await appointmentService.assignEmployee(
      req.user,
      req.params.id,
      req.body,
      req
    );
    return sendSuccess(res, 'Phân công nhân viên thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const confirm = async (req, res, next) => {
  try {
    const data = await appointmentService.confirmAppointment(req.user, req.params.id, req);
    return sendSuccess(res, 'Xác nhận lịch hẹn thành công.', data);
  } catch (err) {
    next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const data = await appointmentService.updateAppointmentStatus(
      req.user,
      req.params.id,
      req.body,
      req
    );
    return sendSuccess(res, 'Cập nhật trạng thái lịch hẹn thành công.', data);
  } catch (err) {
    next(err);
  }
};

export default {
  getAvailability,
  create,
  getOne,
  list,
  reschedule,
  cancel,
  assign,
  confirm,
  updateStatus,
};

