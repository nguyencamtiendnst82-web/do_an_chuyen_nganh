import petService from '../services/petService.js';
import { sendSuccess } from '../utils/response.js';
import { parseId } from '../utils/params.js';

const list = async (req, res, next) => {
  try {
    const data = await petService.listPets(req.user, req.query);
    return sendSuccess(res, 'Lấy danh sách thú cưng thành công.', data);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const data = await petService.getPet(req.user, parseId(req.params.id, 'Mã thú cưng'));
    return sendSuccess(res, 'Lấy thông tin thú cưng thành công.', data);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const data = await petService.createPet(req.user, req.body, req);
    return sendSuccess(res, 'Thêm thú cưng thành công.', data, 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const data = await petService.updatePet(req.user, parseId(req.params.id, 'Mã thú cưng'), req.body, req);
    return sendSuccess(res, 'Cập nhật thú cưng thành công.', data);
  } catch (err) {
    next(err);
  }
};

const archive = async (req, res, next) => {
  try {
    const data = await petService.archivePet(req.user, parseId(req.params.id, 'Mã thú cưng'), req);
    return sendSuccess(res, 'Đã ẩn hồ sơ thú cưng.', data);
  } catch (err) {
    next(err);
  }
};

const uploadPhoto = async (req, res, next) => {
  try {
    const data = await petService.setPetPhoto(req.user, parseId(req.params.id, 'Mã thú cưng'), req.file, req);
    return sendSuccess(res, 'Cập nhật ảnh thú cưng thành công.', data);
  } catch (err) {
    next(err);
  }
};

const removePhoto = async (req, res, next) => {
  try {
    const data = await petService.removePetPhoto(req.user, parseId(req.params.id, 'Mã thú cưng'), req);
    return sendSuccess(res, 'Đã xóa ảnh thú cưng.', data);
  } catch (err) {
    next(err);
  }
};

export { list, getOne, create, update, archive, uploadPhoto, removePhoto };
export default { list, getOne, create, update, archive, uploadPhoto, removePhoto };
