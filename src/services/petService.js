import petRepository from '../repositories/petRepository.js';
import userRepository from '../repositories/userRepository.js';
import logRepository from '../repositories/logRepository.js';
import { createPetSchema, updatePetSchema } from '../validations/petSchemas.js';
import { httpError, fieldError, auditContext } from '../utils/params.js';
import { isRealImageFile } from '../middlewares/uploadImage.js';
import { petPhotos } from '../middlewares/uploadMedia.js';

/**
 * Nghiệp vụ hồ sơ thú cưng.
 * - Customer chỉ thao tác trên thú của CHÍNH MÌNH. Thú của người khác trả 404 (không lộ sự tồn tại).
 * - Staff/admin xem và sửa được tất cả.
 * - Không xóa cứng: "xóa" = ẩn hồ sơ (status = inactive) để giữ lịch sử chăm sóc/lịch hẹn.
 */
const isCustomer = (user) => user.role_name === 'customer';

const NOT_FOUND = 'Không tìm thấy thú cưng.';

/** 'YYYY-MM' → 'YYYY-MM-01' để lưu vào cột DATE (null giữ nguyên) */
const toBirthDate = (ym) => (typeof ym === 'string' ? `${ym}-01` : ym);

const SPECIES = ['dog', 'cat', 'other'];
const SORT_KEYS = ['newest', 'oldest', 'name'];

const roundWeight = (value) => (typeof value === 'number' ? Math.round(value * 100) / 100 : value);

/** Lấy thú cưng và kiểm tra quyền sở hữu */
const loadAccessiblePet = async (user, id) => {
  const pet = await petRepository.findById(id);
  if (!pet || (isCustomer(user) && pet.customer_id !== user.id)) {
    throw httpError(404, NOT_FOUND);
  }
  return pet;
};

const listPets = async (user, query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

  // Mặc định chỉ hiện hồ sơ đang dùng; 'inactive' = đã ẩn; 'all' = tất cả
  const status = ['active', 'inactive', 'all'].includes(query.status) ? query.status : 'active';

  let customerId;
  if (isCustomer(user)) {
    customerId = user.id; // luôn ép về chính mình, bỏ qua customer_id gửi lên
  } else if (query.customer_id) {
    const parsed = Number(query.customer_id);
    if (!Number.isInteger(parsed) || parsed <= 0) throw httpError(400, 'Mã khách hàng không hợp lệ.');
    customerId = parsed;
  }

  const species = SPECIES.includes(query.species) ? query.species : undefined;
  const sort = SORT_KEYS.includes(query.sort) ? query.sort : 'newest';

  const filters = { customerId, status, species, sort, search: search || undefined, page, limit };
  const [pets, total] = await Promise.all([petRepository.findAll(filters), petRepository.countAll(filters)]);

  return {
    pets,
    pagination: { total, page, limit, total_pages: Math.ceil(total / limit) },
  };
};

const getPet = async (user, id) => ({ pet: await loadAccessiblePet(user, id) });

const createPet = async (user, body, req) => {
  const parsed = createPetSchema.parse(body);

  let ownerId;
  if (isCustomer(user)) {
    ownerId = user.id; // KHÔNG nhận customer_id từ khách hàng
  } else {
    if (!parsed.customer_id) throw fieldError('customer_id', 'Vui lòng chọn khách hàng là chủ của thú cưng.');
    const owner = await userRepository.findById(parsed.customer_id);
    if (!owner || owner.role_name !== 'customer' || owner.status !== 'active') {
      throw fieldError('customer_id', 'Khách hàng không tồn tại hoặc không hoạt động.');
    }
    ownerId = owner.id;
  }

  const id = await petRepository.create({
    customer_id: ownerId,
    name: parsed.name,
    species: parsed.species ?? 'dog',
    gender: parsed.gender ?? 'unknown',
    breed: parsed.breed,
    birth_month: toBirthDate(parsed.birth_month),
    weight_kg: roundWeight(parsed.weight_kg),
    special_notes: parsed.special_notes,
  });
  const pet = await petRepository.findById(id);

  await logRepository.insert({
    ...auditContext(req),
    action: 'CREATE_PET',
    entity_name: 'pets',
    entity_id: id,
    new_values: { customer_id: ownerId, name: pet.name, species: pet.species },
  });

  return { pet };
};

const updatePet = async (user, id, body, req) => {
  const parsed = updatePetSchema.parse(body);
  const old = await loadAccessiblePet(user, id);

  const fields = { ...parsed };
  if (fields.weight_kg !== undefined) fields.weight_kg = roundWeight(fields.weight_kg);
  if (fields.birth_month !== undefined) fields.birth_month = toBirthDate(fields.birth_month);

  // Không cho ẩn hồ sơ qua PUT khi còn lịch hẹn chưa hoàn tất
  if (fields.status === 'inactive' && old.status !== 'inactive') {
    if ((await petRepository.countOpenAppointments(id)) > 0) {
      throw httpError(409, 'Thú cưng đang có lịch hẹn chưa hoàn tất, chưa thể ẩn hồ sơ.');
    }
  }

  await petRepository.update(id, fields);
  const pet = await petRepository.findById(id);

  await logRepository.insert({
    ...auditContext(req),
    action: 'UPDATE_PET',
    entity_name: 'pets',
    entity_id: id,
    old_values: {
      name: old.name, species: old.species, breed: old.breed, gender: old.gender,
      birth_month: old.birth_month, weight_kg: old.weight_kg, special_notes: old.special_notes, status: old.status,
    },
    new_values: fields,
  });

  return { pet };
};

/** "Xóa" thú cưng = ẩn hồ sơ (soft delete) */
const archivePet = async (user, id, req) => {
  const old = await loadAccessiblePet(user, id);

  if (old.status !== 'inactive') {
    if ((await petRepository.countOpenAppointments(id)) > 0) {
      throw httpError(409, 'Thú cưng đang có lịch hẹn chưa hoàn tất, chưa thể ẩn hồ sơ.');
    }
    await petRepository.update(id, { status: 'inactive' });

    await logRepository.insert({
      ...auditContext(req),
      action: 'ARCHIVE_PET',
      entity_name: 'pets',
      entity_id: id,
      old_values: { status: old.status },
      new_values: { status: 'inactive' },
    });
  }

  return { pet: await petRepository.findById(id) };
};

/** Tải / thay ảnh thú cưng. `file` là file multer đã lưu tạm trên đĩa. */
const setPetPhoto = async (user, id, file, req) => {
  try {
    if (!file) throw fieldError('photo', 'Vui lòng chọn một ảnh để tải lên.');
    const old = await loadAccessiblePet(user, id);

    if (!(await isRealImageFile(file.path))) {
      throw fieldError('photo', 'Tệp tải lên không phải là ảnh hợp lệ.');
    }

    await petRepository.setAvatar(id, petPhotos.urlPrefix + file.filename);
    await petPhotos.remove(old.avatar_url);

    await logRepository.insert({
      ...auditContext(req),
      action: 'UPDATE_PET_PHOTO',
      entity_name: 'pets',
      entity_id: id,
      new_values: { avatar_url: petPhotos.urlPrefix + file.filename },
    });
    return { pet: await petRepository.findById(id) };
  } catch (err) {
    await petPhotos.discard(file); // không để lại file rác khi lỗi
    throw err;
  }
};

const removePetPhoto = async (user, id, req) => {
  const old = await loadAccessiblePet(user, id);
  if (old.avatar_url) {
    await petRepository.setAvatar(id, null);
    await petPhotos.remove(old.avatar_url);
    await logRepository.insert({
      ...auditContext(req),
      action: 'REMOVE_PET_PHOTO',
      entity_name: 'pets',
      entity_id: id,
      old_values: { avatar_url: old.avatar_url },
    });
  }
  return { pet: await petRepository.findById(id) };
};

export { listPets, getPet, createPet, updatePet, archivePet, setPetPhoto, removePetPhoto };
export default { listPets, getPet, createPet, updatePet, archivePet, setPetPhoto, removePetPhoto };
