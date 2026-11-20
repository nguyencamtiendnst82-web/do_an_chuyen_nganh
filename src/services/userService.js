import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import userRepository from '../repositories/userRepository.js';
import employeeRepository from '../repositories/employeeRepository.js';
import logRepository from '../repositories/logRepository.js';
import petRepository from '../repositories/petRepository.js';
import appointmentRepository from '../repositories/appointmentRepository.js';
import { createEmployeeSchema, updateStatusSchema } from '../validations/userSchemas.js';

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
  const { status, search } = query;
  // Bảng tài khoản chỉ gồm nhân viên và khách hàng; không bao giờ hiển thị quản trị viên
  const role = ['staff', 'customer'].includes(query.role) ? query.role : undefined;

  const filters = { page, limit, role, status, search, excludeRole: 'admin' };
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
        email_verified: 1, // tài khoản nhân viên do admin tạo: admin bảo chứng email
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
 * Admin KHÔNG được sửa thông tin nhân viên/khách hàng (luôn 403 nếu tài khoản tồn tại)
 */
const updateUser = async (targetId) => {
  const target = await userRepository.findById(targetId);
  if (!target) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }
  // Chủ cửa hàng không chỉnh sửa thông tin cá nhân của nhân viên và khách hàng:
  // mỗi người tự cập nhật hồ sơ của mình ở mục "Hồ sơ cá nhân".
  const err = new Error('Quản trị viên không được chỉnh sửa thông tin nhân viên hoặc khách hàng. Mỗi người tự cập nhật hồ sơ của mình.');
  err.statusCode = 403;
  throw err;
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
const resetPassword = async (targetId) => {
  const target = await userRepository.findById(targetId);
  if (!target) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }
  // Chủ cửa hàng không đặt lại mật khẩu của nhân viên hay khách hàng.
  // Mỗi người tự đổi mật khẩu trong "Hồ sơ cá nhân" hoặc dùng chức năng "Quên mật khẩu" qua email.
  const err = new Error('Quản trị viên không được đặt lại mật khẩu của nhân viên hoặc khách hàng. Người dùng tự đổi mật khẩu hoặc dùng chức năng "Quên mật khẩu".');
  err.statusCode = 403;
  throw err;
};

/**
 * Admin xem chi tiết nhân viên / khách hàng (chỉ đọc):
 * thông tin cơ bản + thú cưng + 10 lịch hẹn gần nhất. Không trả password_hash hay token.
 */
const getUserDetail = async (targetId) => {
  const id = parseInt(targetId, 10);
  const target = Number.isInteger(id) && id > 0 ? await userRepository.findById(id) : null;
  if (!target || target.role_name === 'admin') {
    const err = new Error('Không tìm thấy tài khoản.');
    err.statusCode = 404;
    throw err;
  }

  const result = { user: safeUser(target), email_verified: !!target.email_verified };

  if (target.role_name === 'customer') {
    result.pets = await petRepository.findAll({ customerId: id, status: 'all', page: 1, limit: 100 });
    result.recent_appointments = await appointmentRepository.findAll({ customerId: id, page: 1, limit: 10 });
  } else {
    const employee = await employeeRepository.findByUserId(id);
    result.employee = employee || null;
    if (employee) {
      result.recent_appointments = await appointmentRepository.findAll({ employeeId: employee.id, page: 1, limit: 10 });
    }
  }
  return result;
};

export { getUserDetail, listUsers, createEmployee, updateUser, updateUserStatus, resetPassword };
export default { getUserDetail, listUsers, createEmployee, updateUser, updateUserStatus, resetPassword };
