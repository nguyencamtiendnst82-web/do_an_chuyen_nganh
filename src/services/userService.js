import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import userRepository from '../repositories/userRepository.js';
import employeeRepository from '../repositories/employeeRepository.js';
import logRepository from '../repositories/logRepository.js';
import tokenVersionRepository from '../repositories/tokenVersionRepository.js';
import { createEmployeeSchema, updateUserSchema, updateStatusSchema } from '../validations/userSchemas.js';

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
  gender: user.gender ?? null,
  birth_year: user.birth_year ?? null,
  avatar_url: user.avatar_url,
  status: user.status,
  role_name: user.role_name,
  role_display_name: user.role_display_name,
  created_at: user.created_at,
  updated_at: user.updated_at,
  ...(user.employee_id !== undefined && {
    employee_id: user.employee_id,
    specialty: user.specialty,
    experience_years: user.experience_years !== null && user.experience_years !== undefined ? Number(user.experience_years) : null,
    hire_date: user.hire_date,
    employee_status: user.employee_status,
  }),
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
        gender: parsed.gender ?? null,
        birth_year: parsed.birth_year ?? null,
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
    gender: target.gender ?? null,
    birth_year: target.birth_year ?? null,
    avatar_url: target.avatar_url,
  };

  // Cập nhật users (chỉ các trường được phép)
  const userFields = {};
  if (parsed.full_name !== undefined) userFields.full_name = parsed.full_name;
  if (parsed.phone !== undefined) userFields.phone = parsed.phone;
  if (parsed.address !== undefined) userFields.address = parsed.address;
  if (parsed.avatar_url !== undefined) userFields.avatar_url = parsed.avatar_url;
  if (parsed.gender !== undefined) userFields.gender = parsed.gender;
  if (parsed.birth_year !== undefined) userFields.birth_year = parsed.birth_year;

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

  // Không cho khóa hoặc vô hiệu hóa admin cuối cùng
  if (target.role_name === 'admin' && parsed.status !== 'active') {
    const activeAdmins = await userRepository.countActiveAdmins();
    if (activeAdmins <= 1) {
      const err = new Error('Không thể khóa hoặc vô hiệu hóa tài khoản quản trị viên cuối cùng.');
      err.statusCode = 403;
      throw err;
    }
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

/**
 * Admin đặt lại mật khẩu cho tài khoản
 * Tăng token_version để vô hiệu hóa tất cả JWT cũ
 */
const resetPassword = async (targetId, body, req) => {
  const password = body?.password;
  const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
  if (!password || !passwordRegex.test(password)) {
    const err = new Error('Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số.');
    err.statusCode = 422;
    throw err;
  }

  const target = await userRepository.findById(targetId);
  if (!target) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await userRepository.changePassword(targetId, passwordHash);
  await tokenVersionRepository.bump(targetId);

  // Ghi log
  await logRepository.insert({
    user_id: req.user.id,
    action: 'ADMIN_RESET_PASSWORD',
    entity_name: 'users',
    entity_id: targetId,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent'] || null,
  });

  return { message: 'Đặt lại mật khẩu thành công.' };
};

export { listUsers, createEmployee, updateUser, updateUserStatus, resetPassword };
export default { listUsers, createEmployee, updateUser, updateUserStatus, resetPassword };
