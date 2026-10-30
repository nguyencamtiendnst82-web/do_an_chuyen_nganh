import employeeRepository from '../repositories/employeeRepository.js';
import logRepository from '../repositories/logRepository.js';
import { updateEmployeeSchema } from '../validations/employeeSchemas.js';
import { httpError, auditContext, parseId } from '../utils/params.js';

/**
 * Lọc thông tin nhân viên trả về công khai (không lộ email, phone, địa chỉ, ngày sinh)
 */
const safePublicEmployee = (emp) => ({
  id: emp.id,
  full_name: emp.full_name,
  specialty: emp.specialty ?? null,
  experience_years: emp.experience_years !== null ? Number(emp.experience_years) : null,
  avatar_url: emp.avatar_url ?? null,
  hire_date: emp.hire_date,
});

/**
 * Thông tin nhân viên đầy đủ cho Admin
 */
const fullAdminEmployee = (emp) => ({
  id: emp.id,
  user_id: emp.user_id,
  full_name: emp.full_name,
  email: emp.email,
  phone: emp.phone,
  avatar_url: emp.avatar_url ?? null,
  specialty: emp.specialty ?? null,
  experience_years: emp.experience_years !== null ? Number(emp.experience_years) : null,
  hire_date: emp.hire_date,
  status: emp.status,
  user_status: emp.user_status,
  gender: emp.gender ?? null,
  birth_year: emp.birth_year ?? null,
  address: emp.address ?? null,
  created_at: emp.created_at,
  updated_at: emp.updated_at,
});

const listEmployees = async (user, query = {}) => {
  const isAdmin = user && user.role_name === 'admin';
  const requestedScope = query.scope;

  if (requestedScope === 'admin') {
    if (!isAdmin) {
      throw httpError(403, 'Bạn không có quyền xem thông tin nội bộ của nhân viên.');
    }
    const employees = await employeeRepository.findAll({
      scope: 'admin',
      status: query.status,
      search: query.search,
    });
    return employees.map(fullAdminEmployee);
  }

  // Mặc định hoặc khách xem
  const employees = await employeeRepository.findAll({
    scope: 'public',
    search: query.search,
  });
  return employees.map(safePublicEmployee);
};

const getEmployeeById = async (user, rawId) => {
  const id = parseId(rawId, 'ID nhân viên');
  const employee = await employeeRepository.findById(id);
  if (!employee) {
    throw httpError(404, 'Không tìm thấy nhân viên.');
  }

  const isAdmin = user && user.role_name === 'admin';

  if (!isAdmin) {
    // Nếu nhân viên không còn active thì không cho khách xem
    if (employee.status !== 'active' || employee.user_status !== 'active') {
      throw httpError(404, 'Không tìm thấy nhân viên.');
    }
    return safePublicEmployee(employee);
  }

  return fullAdminEmployee(employee);
};

const updateEmployee = async (user, rawId, body, req) => {
  const id = parseId(rawId, 'ID nhân viên');
  const parsed = updateEmployeeSchema.parse(body);

  const existing = await employeeRepository.findById(id);
  if (!existing) {
    throw httpError(404, 'Không tìm thấy nhân viên.');
  }

  const oldValues = {
    specialty: existing.specialty,
    experience_years: existing.experience_years,
    hire_date: existing.hire_date,
    status: existing.status,
  };

  // Nếu đổi sang trạng thái nghỉ việc hoặc tạm nghỉ, kiểm tra lịch hẹn tương lai
  if (
    parsed.status &&
    parsed.status !== existing.status &&
    (parsed.status === 'resigned' || parsed.status === 'on_leave')
  ) {
    const futureApts = await employeeRepository.countActiveFutureAppointmentsByEmployee(id);
    if (futureApts > 0) {
      const statusLabel = parsed.status === 'resigned' ? 'đã nghỉ việc' : 'tạm nghỉ';
      throw httpError(
        409,
        `Không thể chuyển trạng thái nhân viên sang "${statusLabel}" vì nhân viên còn ${futureApts} lịch hẹn chưa hoàn thành trong tương lai.`
      );
    }
  }

  const fieldsToUpdate = {};
  if (parsed.specialty !== undefined) fieldsToUpdate.specialty = parsed.specialty;
  if (parsed.experience_years !== undefined) fieldsToUpdate.experience_years = parsed.experience_years;
  if (parsed.hire_date !== undefined) fieldsToUpdate.hire_date = parsed.hire_date;
  if (parsed.status !== undefined) fieldsToUpdate.status = parsed.status;

  if (Object.keys(fieldsToUpdate).length > 0) {
    await employeeRepository.updateById(id, fieldsToUpdate);
  }

  const audit = auditContext(req);
  await logRepository.insert({
    user_id: user.id,
    action: 'UPDATE_EMPLOYEE',
    entity_name: 'employees',
    entity_id: id,
    old_values: oldValues,
    new_values: fieldsToUpdate,
    ip_address: audit.ip_address,
    user_agent: audit.user_agent,
  });

  const updated = await employeeRepository.findById(id);
  return fullAdminEmployee(updated);
};

export { listEmployees, getEmployeeById, updateEmployee };
export default { listEmployees, getEmployeeById, updateEmployee };

