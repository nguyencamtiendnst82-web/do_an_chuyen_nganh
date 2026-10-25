import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import userRepository from '../repositories/userRepository.js';
import logRepository from '../repositories/logRepository.js';
import { AVATAR_URL_PREFIX, isRealImageFile, deleteAvatarFile } from '../middlewares/uploadImage.js';
import { registerSchema, loginSchema, updateMeSchema, changePasswordSchema } from '../validations/authSchemas.js';

// Hằng số role_id (đồng bộ với seed.sql)
const CUSTOMER_ROLE_ID = 3;

/**
 * Ký JWT cho user
 */
const signToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

/**
 * Lọc thông tin user an toàn để trả về client (không trả password_hash)
 */
const safeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  phone: user.phone,
  address: user.address,
  avatar_url: user.avatar_url,
  status: user.status,
  role_name: user.role_name,
  role_display_name: user.role_display_name,
  created_at: user.created_at,
});

/**
 * Đăng ký tài khoản mới (chỉ tạo customer)
 */
const register = async (body, req) => {
  // Validate dữ liệu đầu vào
  const parsed = registerSchema.parse(body);

  // Kiểm tra email đã tồn tại chưa
  const existingByEmail = await userRepository.findByEmail(parsed.email);
  if (existingByEmail) {
    const err = new Error('Email này đã được đăng ký. Vui lòng dùng email khác.');
    err.statusCode = 409;
    throw err;
  }

  // Kiểm tra phone đã tồn tại chưa
  const existingByPhone = await userRepository.findByPhone(parsed.phone);
  if (existingByPhone) {
    const err = new Error('Số điện thoại này đã được đăng ký. Vui lòng dùng số khác.');
    err.statusCode = 409;
    throw err;
  }

  // Băm mật khẩu (cost 10 theo GEMINI.md)
  const passwordHash = await bcrypt.hash(parsed.password, 10);

  // Server tự gán role customer (KHÔNG nhận role từ client)
  const userId = await userRepository.create({
    role_id: CUSTOMER_ROLE_ID,
    full_name: parsed.full_name,
    email: parsed.email,
    phone: parsed.phone,
    password_hash: passwordHash,
    address: parsed.address || null,
  });

  // Ghi log
  await logRepository.insert({
    user_id: userId,
    action: 'USER_REGISTER',
    entity_name: 'users',
    entity_id: userId,
    new_values: { email: parsed.email, phone: parsed.phone, role: 'customer' },
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  // Trả về thông tin user (không trả password_hash)
  const user = await userRepository.findById(userId);
  return safeUser(user);
};

/**
 * Đăng nhập bằng email hoặc phone
 * Thông báo lỗi KHÔNG tiết lộ email có tồn tại hay không
 */
const login = async (body, req) => {
  const parsed = loginSchema.parse(body);

  // Tìm user theo email hoặc phone
  const user = await userRepository.findByEmailOrPhone(parsed.credential);

  // Thông báo chung chung: không tiết lộ tài khoản có tồn tại không
  const genericError = new Error('Email/số điện thoại hoặc mật khẩu không đúng.');
  genericError.statusCode = 401;

  if (!user) throw genericError;

  // Từ chối tài khoản không active TRƯỚC KHI so mật khẩu
  if (user.status === 'locked') {
    const err = new Error('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
    err.statusCode = 403;
    throw err;
  }
  if (user.status === 'inactive') {
    const err = new Error('Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ quản trị viên.');
    err.statusCode = 403;
    throw err;
  }

  // So sánh mật khẩu
  const isMatch = await bcrypt.compare(parsed.password, user.password_hash);
  if (!isMatch) throw genericError;

  // Ký token
  const token = signToken(user.id);

  // Ghi log
  await logRepository.insert({
    user_id: user.id,
    action: 'USER_LOGIN',
    entity_name: 'users',
    entity_id: user.id,
    new_values: { credential: parsed.credential },
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  return {
    token,
    user: safeUser(user),
  };
};

/**
 * Đăng xuất (client xóa token; server chỉ ghi log)
 */
const logout = async (req) => {
  await logRepository.insert({
    user_id: req.user.id,
    action: 'USER_LOGOUT',
    entity_name: 'users',
    entity_id: req.user.id,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });
};

/**
 * Lấy thông tin hồ sơ cá nhân
 */
const getMe = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }
  return safeUser(user);
};

/**
 * Cập nhật hồ sơ cá nhân (full_name, phone, address)
 * Ảnh đại diện KHÔNG còn cập nhật qua đây (không nhận URL tự do từ client),
 * mà đi qua uploadAvatar / removeAvatar.
 */
const updateMe = async (userId, body, req) => {
  const parsed = updateMeSchema.parse(body);

  // Loại bỏ avatar_url nếu client vẫn gửi lên
  // eslint-disable-next-line no-unused-vars
  const { avatar_url, ...fields } = parsed;

  // Nếu đổi phone, kiểm tra trùng với người khác
  if (fields.phone) {
    const existingByPhone = await userRepository.findByPhone(fields.phone);
    if (existingByPhone && existingByPhone.id !== userId) {
      const err = new Error('Số điện thoại này đã được đăng ký bởi tài khoản khác.');
      err.statusCode = 409;
      throw err;
    }
  }

  const oldUser = await userRepository.findById(userId);
  await userRepository.update(userId, fields);

  // Ghi log
  await logRepository.insert({
    user_id: userId,
    action: 'UPDATE_PROFILE',
    entity_name: 'users',
    entity_id: userId,
    old_values: { full_name: oldUser.full_name, phone: oldUser.phone, address: oldUser.address },
    new_values: fields,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  const updated = await userRepository.findById(userId);
  return safeUser(updated);
};

/**
 * Xóa file vừa tải lên khi có lỗi (tránh để lại file rác)
 */
const discardUploadedFile = async (file) => {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[Avatar] Không xóa được file tạm:', err.message);
  }
};

/**
 * Tải ảnh đại diện lên
 * - Kiểm tra lại nội dung file có đúng là ảnh thật (magic bytes)
 * - Xóa ảnh cũ trên đĩa, lưu đường dẫn mới vào users.avatar_url
 */
const uploadAvatar = async (userId, file, req) => {
  if (!file) {
    const err = new Error('Vui lòng chọn một ảnh để tải lên.');
    err.statusCode = 422;
    throw err;
  }

  try {
    const isImage = await isRealImageFile(file.path);
    if (!isImage) {
      const err = new Error('Tệp tải lên không phải là ảnh hợp lệ.');
      err.statusCode = 422;
      throw err;
    }

    const oldUser = await userRepository.findById(userId);
    const newUrl = AVATAR_URL_PREFIX + file.filename;

    await userRepository.update(userId, { avatar_url: newUrl });

    // Chỉ xóa ảnh cũ sau khi đã lưu CSDL thành công
    await deleteAvatarFile(oldUser?.avatar_url);

    await logRepository.insert({
      user_id: userId,
      action: 'UPDATE_AVATAR',
      entity_name: 'users',
      entity_id: userId,
      old_values: { avatar_url: oldUser?.avatar_url || null },
      new_values: { avatar_url: newUrl },
      ip_address: req.ip || null,
      user_agent: req.headers?.['user-agent'] || null,
    });

    const updated = await userRepository.findById(userId);
    return safeUser(updated);
  } catch (err) {
    await discardUploadedFile(file);
    throw err;
  }
};

/**
 * Gỡ ảnh đại diện
 */
const removeAvatar = async (userId, req) => {
  const oldUser = await userRepository.findById(userId);

  await userRepository.update(userId, { avatar_url: null });
  await deleteAvatarFile(oldUser?.avatar_url);

  await logRepository.insert({
    user_id: userId,
    action: 'REMOVE_AVATAR',
    entity_name: 'users',
    entity_id: userId,
    old_values: { avatar_url: oldUser?.avatar_url || null },
    new_values: { avatar_url: null },
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  const updated = await userRepository.findById(userId);
  return safeUser(updated);
};

/**
 * Tạo lỗi 422 gắn theo trường (để frontend hiện dưới đúng ô nhập)
 */
const fieldError = (field, message) => {
  const err = new Error('Dữ liệu gửi lên không đúng định dạng');
  err.statusCode = 422;
  err.errors = [{ field, message }];
  return err;
};

/**
 * Đổi mật khẩu (yêu cầu mật khẩu cũ)
 * - Ghi nhật ký cả khi thất bại (phục vụ phát hiện dò mật khẩu)
 * - Mật khẩu mới: không trùng mật khẩu cũ, không chứa email/số điện thoại, không vượt 72 byte (giới hạn bcrypt)
 */
const changePassword = async (userId, body, req) => {
  const parsed = changePasswordSchema.parse(body);

  const user = await userRepository.findById(userId);
  const logBase = {
    user_id: userId,
    entity_name: 'users',
    entity_id: userId,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  };

  // 1. Xác minh mật khẩu hiện tại
  const isMatch = await bcrypt.compare(parsed.old_password, user.password_hash);
  if (!isMatch) {
    await logRepository.insert({
      ...logBase,
      action: 'CHANGE_PASSWORD_FAILED',
      new_values: { reason: 'wrong_old_password' },
    });
    const err = new Error('Mật khẩu hiện tại không đúng.');
    err.statusCode = 400;
    throw err;
  }

  // 2. Chính sách cho mật khẩu mới
  if (parsed.new_password === parsed.old_password) {
    throw fieldError('new_password', 'Mật khẩu mới không được trùng với mật khẩu hiện tại.');
  }

  if (Buffer.byteLength(parsed.new_password, 'utf8') > 72) {
    throw fieldError('new_password', 'Mật khẩu quá dài (tối đa 72 ký tự).');
  }

  const lowered = parsed.new_password.toLowerCase();
  const emailLocal = (user.email || '').split('@')[0].toLowerCase();
  if ((emailLocal.length >= 4 && lowered.includes(emailLocal)) || (user.phone && lowered.includes(user.phone))) {
    throw fieldError('new_password', 'Mật khẩu không nên chứa email hoặc số điện thoại của bạn.');
  }

  // 3. Băm và lưu
  const newHash = await bcrypt.hash(parsed.new_password, 10);
  await userRepository.changePassword(userId, newHash);

  // Ghi log (không lưu mật khẩu)
  await logRepository.insert({
    ...logBase,
    action: 'CHANGE_PASSWORD',
  });
};

export { register, login, logout, getMe, updateMe, uploadAvatar, removeAvatar, changePassword };
export default { register, login, logout, getMe, updateMe, uploadAvatar, removeAvatar, changePassword };