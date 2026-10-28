import employeeService from '../services/employeeService.js';
import { sendSuccess } from '../utils/response.js';

const list = async (req, res, next) => {
  try {
    const data = await employeeService.listEmployees(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách nhân viên thành công.', data);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await employeeService.getEmployeeById(req.user, req.params.id);
    return sendSuccess(res, 'Lấy thông tin nhân viên thành công.', data);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await employeeService.updateEmployee(req.user, req.params.id, req.body, req);
    return sendSuccess(res, 'Cập nhật thông tin nhân viên thành công.', data);
  } catch (err) {
    next(err);
  }
};

export { list, getOne, update };
export default { list, getOne, update };

