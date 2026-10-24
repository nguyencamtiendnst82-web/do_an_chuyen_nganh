const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const userRepository = require('../repositories/userRepository');
const employeeRepository = require('../repositories/employeeRepository');
const logRepository = require('../repositories/logRepository');
const { createEmployeeSchema, updateUserSchema, updateStatusSchema } = require('../validations/userSchemas');

// Hằng role_id (đồng bộ seed.sql)
const STAFF_ROLE_ID = 2;

/**
 * Lọc thông tin user an toàn (không trả password_hash)
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
  updated_at: user.updated_at,
});

/**
 * Lấy danh sách users có phân trang, lọc, tìm kiếm
 */
const listUsers = async (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const { role, status, search } = query;

  const filters = { page, limit, role, status, search };
  const [users, total] = await Promise.all([
    userRepository.findAll(filters),
    userRepository.countAll(filters),
  ]);

  return {
    users: users.map(safeUser),
    pagination: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Admin tạo nhân viên mới:
 * 1. Tạo bản ghi users với role staff
 * 2. Tạo bản ghi employees
 * Thực hiện trong 1 TRANSACTION
 */
const createEmployee = async (body, req) => {
  const parsed = createEmployeeSchema.parse(body);

  // Kiểm tra unique email
  const existingByEmail = await userRepository.findByEmail(parsed.email);
  if (existingByEmail) {
    const err = new Error('Email này đã được đăng ký. Vui lòng dùng email khác.');
    err.statusCode = 409;
    throw err;
  }

  // Kiểm tra unique phone
  const existingByPhone = await userRepository.findByPhone(parsed.phone);
  if (existingByPhone) {
    const err = new Error('Số điện thoại này đã được đăng ký. Vui lòng dùng số khác.');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  // Transaction: tạo user + employee cùng lúc
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const userId = await userRepository.create(
      {
        role_id: STAFF_ROLE_ID,
        full_name: parsed.full_name,
        email: parsed.email,
        phone: parsed.phone,
        password_hash: passwordHash,
        address: parsed.address || null,
      },
      connection
    );

    const employeeId = await employeeRepository.create(
      userId,
      {
        specialty: parsed.specialty,
        experience_years: parsed.experience_years,
        hire_date: parsed.hire_date,
      },
      connection
    );

    await connection.commit();

    // Ghi log
    await logRepository.insert({
      user_id: req.user.id,
      action: 'CREATE_EMPLOYEE',
      entity_name: 'users',
      entity_id: userId,
      new_values: {
        email: parsed.email,
        phone: parsed.phone,
        employee_id: employeeId,
        role: 'staff',
      },
      ip_address: req.ip || null,
      user_agent: req.headers?.['user-agent'] || null,
    });

    const newUser = await userRepository.findById(userId);
    const employee = await employeeRepository.findByUserId(userId);

    return {
      user: safeUser(newUser),
      employee,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
};

/**
 * Admin cập nhật thông tin user (không cho đổi role_id, email, password_hash)
 */
const updateUser = async (targetId, body, req) => {
  const parsed = updateUserSchema.parse(body);

  const target = await userRepository.findById(targetId);
  if (!target) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }

  // Kiểm tra phone trùng với người khác
  if (parsed.phone) {
    const existingByPhone = await userRepository.findByPhone(parsed.phone);
    if (existingByPhone && existingByPhone.id !== parseInt(targetId)) {
      const err = new Error('Số điện thoại này đã được đăng ký bởi tài khoản khác.');
      err.statusCode = 409;
      throw err;
    }
  }

  // Lấy dữ liệu cũ để ghi log
  const oldValues = {
    full_name: target.full_name,
    phone: target.phone,
    address: target.address,
    avatar_url: target.avatar_url,
  };

  // Cập nhật users (chỉ các trường được phép)
  const userFields = {};
  if (parsed.full_name !== undefined) userFields.full_name = parsed.full_name;
  if (parsed.phone !== undefined) userFields.phone = parsed.phone;
  if (parsed.address !== undefined) userFields.address = parsed.address;
  if (parsed.avatar_url !== undefined) userFields.avatar_url = parsed.avatar_url;

  if (Object.keys(userFields).length > 0) {
    await userRepository.update(targetId, userFields);
  }

  // Cập nhật employees nếu user là staff và có dữ liệu nhân viên
  if (target.role_name === 'staff' && (parsed.specialty !== undefined || parsed.experience_years !== undefined)) {
    await employeeRepository.updateByUserId(targetId, {
      specialty: parsed.specialty,
      experience_years: parsed.experience_years,
    });
  }

  // Ghi log
  await logRepository.insert({
    user_id: req.user.id,
    action: 'UPDATE_USER',
    entity_name: 'users',
    entity_id: targetId,
    old_values: oldValues,
    new_values: parsed,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  const updated = await userRepository.findById(targetId);
  const employee = target.role_name === 'staff' ? await employeeRepository.findByUserId(targetId) : null;

  return { user: safeUser(updated), employee };
};

/**
 * Admin cập nhật trạng thái tài khoản
 * Không cho admin tự khóa/vô hiệu hóa chính mình
 */
const updateUserStatus = async (targetId, body, req) => {
  const parsed = updateStatusSchema.parse(body);
  const actorId = req.user.id;

  if (parseInt(targetId) === actorId) {
    const err = new Error('Bạn không thể thay đổi trạng thái tài khoản của chính mình.');
    err.statusCode = 403;
    throw err;
  }

  const target = await userRepository.findById(targetId);
  if (!target) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }

  const oldStatus = target.status;
  await userRepository.updateStatus(targetId, parsed.status);

  // Ghi log
  await logRepository.insert({
    user_id: actorId,
    action: 'CHANGE_USER_STATUS',
    entity_name: 'users',
    entity_id: targetId,
    old_values: { status: oldStatus },
    new_values: { status: parsed.status },
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  const updated = await userRepository.findById(targetId);
  return safeUser(updated);
};

module.exports = {
  listUsers,
  createEmployee,
  updateUser,
  updateUserStatus,
};
