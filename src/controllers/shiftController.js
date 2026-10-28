import shiftService from '../services/shiftService.js';
import { sendSuccess } from '../utils/response.js';

const list = async (req, res, next) => {
  try {
    const data = await shiftService.listShifts(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách ca làm việc thành công.', data);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await shiftService.getShiftById(req.params.id);
    return sendSuccess(res, 'Lấy thông tin ca làm việc thành công.', data);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await shiftService.createShift(req.user, req.body, req);
    return sendSuccess(res, 'Tạo ca làm việc thành công.', data, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await shiftService.updateShift(req.user, req.params.id, req.body, req);
    return sendSuccess(res, 'Cập nhật ca làm việc thành công.', data);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const data = await shiftService.deleteShift(req.user, req.params.id, req);
    return sendSuccess(res, data.message);
  } catch (err) {
    next(err);
  }
};

export { list, getOne, create, update, remove };
export default { list, getOne, create, update, remove };

