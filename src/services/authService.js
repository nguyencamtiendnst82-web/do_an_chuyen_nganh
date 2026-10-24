const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const logRepository = require('../repositories/logRepository');
const {
  registerSchema,
  loginSchema,
  updateMeSchema,
  changePasswordSchema,
} = require('../validations/authSchemas');

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
 * Cập nhật hồ sơ cá nhân (full_name, phone, address, avatar_url)
 */
const updateMe = async (userId, body, req) => {
  const parsed = updateMeSchema.parse(body);

  // Nếu đổi phone, kiểm tra trùng với người khác
  if (parsed.phone) {
    const existingByPhone = await userRepository.findByPhone(parsed.phone);
    if (existingByPhone && existingByPhone.id !== userId) {
      const err = new Error('Số điện thoại này đã được đăng ký bởi tài khoản khác.');
      err.statusCode = 409;
      throw err;
    }
  }

  const oldUser = await userRepository.findById(userId);
  await userRepository.update(userId, parsed);

  // Ghi log
  await logRepository.insert({
    user_id: userId,
    action: 'UPDATE_PROFILE',
    entity_name: 'users',
    entity_id: userId,
    old_values: { full_name: oldUser.full_name, phone: oldUser.phone, address: oldUser.address },
    new_values: parsed,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  const updated = await userRepository.findById(userId);
  return safeUser(updated);
};

/**
 * Đổi mật khẩu (yêu cầu mật khẩu cũ)
 */
const changePassword = async (userId, body, req) => {
  const parsed = changePasswordSchema.parse(body);

  const user = await userRepository.findById(userId);
  const isMatch = await bcrypt.compare(parsed.old_password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Mật khẩu cũ không đúng.');
    err.statusCode = 400;
    throw err;
  }

  const newHash = await bcrypt.hash(parsed.new_password, 10);
  await userRepository.changePassword(userId, newHash);

  // Ghi log (không lưu mật khẩu)
  await logRepository.insert({
    user_id: userId,
    action: 'CHANGE_PASSWORD',
    entity_name: 'users',
    entity_id: userId,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
};
