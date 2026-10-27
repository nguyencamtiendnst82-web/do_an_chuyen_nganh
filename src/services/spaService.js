import serviceRepository from '../repositories/serviceRepository.js';
import logRepository from '../repositories/logRepository.js';
import { createServiceSchema, updateServiceSchema, setActiveSchema } from '../validations/serviceSchemas.js';
import { httpError, fieldError, auditContext } from '../utils/params.js';
import { isRealImageFile } from '../middlewares/uploadImage.js';
import { serviceImages } from '../middlewares/uploadMedia.js';

/**
 * Nghiệp vụ danh mục dịch vụ spa.
 * - Khách hàng chỉ thấy dịch vụ đang bật.
 * - Staff/admin xem được tất cả; chỉ admin được thêm/sửa/bật-tắt (kiểm tra ở route).
 * - Không xóa cứng dịch vụ (đã có thể nằm trong lịch hẹn/hóa đơn) → chỉ ẩn bằng is_active.
 */
const isStaffOrAdmin = (user) => user.role_name === 'staff' || user.role_name === 'admin';

const parseActiveFilter = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const listServices = async (user, query = {}) => {
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';
  const is_active = isStaffOrAdmin(user) ? parseActiveFilter(query.is_active) : true;

  const services = await serviceRepository.findAll({ search: search || undefined, is_active });
  return { services };
};

const getService = async (user, id) => {
  const service = await serviceRepository.findById(id);
  // Khách hàng không được biết đến sự tồn tại của dịch vụ đã ẩn
  if (!service || (!service.is_active && !isStaffOrAdmin(user))) {
    throw httpError(404, 'Không tìm thấy dịch vụ.');
  }
  return { service };
};

const createService = async (body, req) => {
  const parsed = createServiceSchema.parse(body);

  if (await serviceRepository.findByName(parsed.name)) {
    throw fieldError('name', 'Đã có dịch vụ trùng tên này.');
  }

  const id = await serviceRepository.create(parsed);
  const service = await serviceRepository.findById(id);

  await logRepository.insert({
    ...auditContext(req),
    action: 'CREATE_SERVICE',
    entity_name: 'services',
    entity_id: id,
    new_values: { name: service.name, price: service.price, duration_minutes: service.duration_minutes },
  });

  return { service };
};

const updateService = async (id, body, req) => {
  const parsed = updateServiceSchema.parse(body);

  const old = await serviceRepository.findById(id);
  if (!old) throw httpError(404, 'Không tìm thấy dịch vụ.');

  if (parsed.name !== undefined && (await serviceRepository.findByName(parsed.name, id))) {
    throw fieldError('name', 'Đã có dịch vụ trùng tên này.');
  }

  await serviceRepository.update(id, parsed);
  const service = await serviceRepository.findById(id);

  await logRepository.insert({
    ...auditContext(req),
    action: 'UPDATE_SERVICE',
    entity_name: 'services',
    entity_id: id,
    old_values: {
      name: old.name,
      description: old.description,
      price: old.price,
      duration_minutes: old.duration_minutes,
    },
    new_values: parsed,
  });

  return { service };
};

const setServiceActive = async (id, body, req) => {
  const { is_active } = setActiveSchema.parse(body);

  const old = await serviceRepository.findById(id);
  if (!old) throw httpError(404, 'Không tìm thấy dịch vụ.');

  await serviceRepository.setActive(id, is_active);
  const service = await serviceRepository.findById(id);

  await logRepository.insert({
    ...auditContext(req),
    action: is_active ? 'ACTIVATE_SERVICE' : 'DEACTIVATE_SERVICE',
    entity_name: 'services',
    entity_id: id,
    old_values: { is_active: old.is_active },
    new_values: { is_active },
  });

  return { service };
};

/** Tải / thay ảnh dịch vụ (admin). `file` là file multer đã lưu tạm trên đĩa. */
const setServiceImage = async (id, file, req) => {
  try {
    if (!file) throw fieldError('image', 'Vui lòng chọn một ảnh để tải lên.');
    const old = await serviceRepository.findById(id);
    if (!old) throw httpError(404, 'Không tìm thấy dịch vụ.');

    if (!(await isRealImageFile(file.path))) {
      throw fieldError('image', 'Tệp tải lên không phải là ảnh hợp lệ.');
    }

    const url = serviceImages.urlPrefix + file.filename;
    await serviceRepository.setImage(id, url);
    await serviceImages.remove(old.image_url);

    await logRepository.insert({
      ...auditContext(req),
      action: 'UPDATE_SERVICE_IMAGE',
      entity_name: 'services',
      entity_id: id,
      new_values: { image_url: url },
    });
    return { service: await serviceRepository.findById(id) };
  } catch (err) {
    await serviceImages.discard(file);
    throw err;
  }
};

const removeServiceImage = async (id, req) => {
  const old = await serviceRepository.findById(id);
  if (!old) throw httpError(404, 'Không tìm thấy dịch vụ.');
  if (old.image_url) {
    await serviceRepository.setImage(id, null);
    await serviceImages.remove(old.image_url);
    await logRepository.insert({
      ...auditContext(req),
      action: 'REMOVE_SERVICE_IMAGE',
      entity_name: 'services',
      entity_id: id,
      old_values: { image_url: old.image_url },
    });
  }
  return { service: await serviceRepository.findById(id) };
};

export { listServices, getService, createService, updateService, setServiceActive, setServiceImage, removeServiceImage };
export default { listServices, getService, createService, updateService, setServiceActive, setServiceImage, removeServiceImage };
