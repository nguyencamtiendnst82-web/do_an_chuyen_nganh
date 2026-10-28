import employeeShiftService from '../services/employeeShiftService.js';
import { sendSuccess } from '../utils/response.js';

const bulkAssign = async (req, res, next) => {
  try {
    const data = await employeeShiftService.bulkAssignShifts(req.user, req.body, req);
    return sendSuccess(res, 'Phân ca làm việc hoàn tất.', data, 201);
  } catch (err) {
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const data = await employeeShiftService.listEmployeeShifts(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách phân ca thành công.', data);
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const data = await employeeShiftService.getMyShifts(req.user, req.query);
    return sendSuccess(res, 'Lấy lịch làm việc của bạn thành công.', data);
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const data = await employeeShiftService.deleteEmployeeShift(req.user, req.params.id, req);
    return sendSuccess(res, data.message);
  } catch (err) {
    next(err);
  }
};

export { bulkAssign, list, getMe, remove };
export default { bulkAssign, list, getMe, remove };

