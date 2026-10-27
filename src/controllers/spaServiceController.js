import spaService from '../services/spaService.js';
import { sendSuccess } from '../utils/response.js';
import { parseId } from '../utils/params.js';

const list = async (req, res, next) => {
  try {
    const data = await spaService.listServices(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách dịch vụ thành công.', data);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await spaService.getService(req.user, parseId(req.params.id, 'Mã dịch vụ'));
    return sendSuccess(res, 'Lấy thông tin dịch vụ thành công.', data);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await spaService.createService(req.body, req);
    return sendSuccess(res, 'Tạo dịch vụ thành công.', data, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await spaService.updateService(parseId(req.params.id, 'Mã dịch vụ'), req.body, req);
    return sendSuccess(res, 'Cập nhật dịch vụ thành công.', data);
  } catch (err) {
    next(err);
  }
};

const setActive = async (req, res, next) => {
  try {
    const data = await spaService.setServiceActive(parseId(req.params.id, 'Mã dịch vụ'), req.body, req);
    return sendSuccess(res, data.service.is_active ? 'Đã bật dịch vụ.' : 'Đã ẩn dịch vụ.', data);
  } catch (err) {
    next(err);
  }
};

const uploadImage = async (req, res, next) => {
  try {
    const data = await spaService.setServiceImage(parseId(req.params.id, 'Mã dịch vụ'), req.file, req);
    return sendSuccess(res, 'Cập nhật ảnh dịch vụ thành công.', data);
  } catch (err) {
    next(err);
  }
};

const removeImage = async (req, res, next) => {
  try {
    const data = await spaService.removeServiceImage(parseId(req.params.id, 'Mã dịch vụ'), req);
    return sendSuccess(res, 'Đã xóa ảnh dịch vụ.', data);
  } catch (err) {
    next(err);
  }
};

export { list, getOne, create, update, setActive, uploadImage, removeImage };
export default { list, getOne, create, update, setActive, uploadImage, removeImage };
