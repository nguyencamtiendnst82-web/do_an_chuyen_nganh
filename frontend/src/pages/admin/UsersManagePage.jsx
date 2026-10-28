import { useCallback, useEffect, useState } from 'react';
import userApi from '../../api/userApi';
import Modal from '../../components/Modal';
import { TableSkeleton } from '../../components/Skeleton';
import { useToast, useConfirm } from '../../components/Feedback';
import { errorMessage, mapFieldErrors } from '../../utils/format';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_BADGE = {
  admin: { bg: 'bg-purple-100 text-purple-700', label: 'Quản trị viên' },
  staff: { bg: 'bg-blue-100 text-blue-700', label: 'Nhân viên' },
  customer: { bg: 'bg-pink-100 text-pink-700', label: 'Khách hàng' },
};

const STATUS_BADGE = {
  active: { bg: 'bg-green-100 text-green-700', label: 'Hoạt động' },
  inactive: { bg: 'bg-gray-100 text-gray-700', label: 'Tạm ngưng' },
  locked: { bg: 'bg-red-100 text-red-700', label: 'Đã khóa' },
};

const EMPTY_EMPLOYEE_FORM = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  address: '',
  gender: '',
  birth_year: '',
  specialty: '',
  experience_years: '1.0',
  hire_date: new Date().toISOString().slice(0, 10),
};

const inputClass = (hasError) =>
  `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`;

const UsersManagePage = () => {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, total_pages: 1 });
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal tạo nhân viên
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_EMPLOYEE_FORM);
  const [createErrors, setCreateErrors] = useState({});
  const [savingCreate, setSavingCreate] = useState(false);

  // Modal sửa thông tin user / employee
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal đổi mật khẩu
  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [savingReset, setSavingReset] = useState(false);

  const fetchUsers = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const res = await userApi.listUsers({
          page,
          limit: pagination.limit,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          search: search.trim() || undefined,
        });
        setUsers(res.data.data.users);
        setPagination(res.data.data.pagination);
      } catch (err) {
        toast.error(errorMessage(err, 'Không thể tải danh sách tài khoản.'));
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, roleFilter, statusFilter, search, toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, roleFilter, statusFilter]);

  // Tạo nhân viên mới
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});
    setSavingCreate(true);
    try {
      const payload = {
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        password: createForm.password,
        address: createForm.address.trim() || null,
        gender: createForm.gender || null,
        birth_year: createForm.birth_year ? Number(createForm.birth_year) : null,
        specialty: createForm.specialty.trim() || null,
        experience_years: createForm.experience_years ? Number(createForm.experience_years) : 1.0,
        hire_date: createForm.hire_date,
      };

      await userApi.createEmployee(payload);
      toast.success('Tạo tài khoản nhân viên thành công.');
      setShowCreateModal(false);
      setCreateForm(EMPTY_EMPLOYEE_FORM);
      fetchUsers(1);
    } catch (err) {
      const fieldErrs = mapFieldErrors(err);
      if (fieldErrs) {
        setCreateErrors(fieldErrs);
      } else {
        toast.error(errorMessage(err, 'Tạo nhân viên thất bại.'));
      }
    } finally {
      setSavingCreate(false);
    }
  };

  // Mở modal sửa
  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name || '',
      phone: u.phone || '',
      address: u.address || '',
      gender: u.gender || '',
      birth_year: u.birth_year ? String(u.birth_year) : '',
      specialty: u.specialty || '',
      experience_years: u.experience_years !== null ? String(u.experience_years) : '1.0',
    });
    setEditErrors({});
  };

  // Sửa user
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditErrors({});
    setSavingEdit(true);
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        phone: editForm.phone.trim(),
        address: editForm.address.trim() || null,
        gender: editForm.gender || null,
        birth_year: editForm.birth_year ? Number(editForm.birth_year) : null,
      };

      if (editingUser.role_name === 'staff') {
        payload.specialty = editForm.specialty.trim() || null;
        payload.experience_years = editForm.experience_years ? Number(editForm.experience_years) : 1.0;
      }

      await userApi.updateUser(editingUser.id, payload);
      toast.success('Cập nhật tài khoản thành công.');
      setEditingUser(null);
      fetchUsers(pagination.page);
    } catch (err) {
      const fieldErrs = mapFieldErrors(err);
      if (fieldErrs) {
        setEditErrors(fieldErrs);
      } else {
        toast.error(errorMessage(err, 'Cập nhật tài khoản thất bại.'));
      }
    } finally {
      setSavingEdit(false);
    }
  };

  // Đổi trạng thái tài khoản (khóa / mở khóa)
  const handleToggleStatus = async (targetUser) => {
    const isLocking = targetUser.status === 'active';
    const newStatus = isLocking ? 'locked' : 'active';
    const actionText = isLocking ? 'Khóa' : 'Mở khóa';

    const confirmed = await confirm({
      title: `${actionText} tài khoản?`,
      message: `Bạn có chắc chắn muốn ${actionText.toLowerCase()} tài khoản "${targetUser.full_name}" (${targetUser.email})?`,
      confirmText: actionText,
      danger: isLocking,
    });

    if (!confirmed) return;

    try {
      await userApi.updateUserStatus(targetUser.id, newStatus);
      toast.success(`${actionText} tài khoản thành công.`);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(errorMessage(err, `Không thể ${actionText.toLowerCase()} tài khoản.`));
    }
  };

  // Đặt lại mật khẩu
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!newPassword || newPassword.length < 8) {
      setResetError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    setSavingReset(true);
    try {
      await userApi.resetPassword(resettingUser.id, newPassword);
      toast.success(`Đã đặt lại mật khẩu cho "${resettingUser.full_name}".`);
      setResettingUser(null);
      setNewPassword('');
    } catch (err) {
      setResetError(errorMessage(err, 'Không thể đặt lại mật khẩu.'));
    } finally {
      setSavingReset(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Nút thêm nhân viên */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Tài khoản & Nhân viên</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh sách người dùng, nhân viên spa, phân quyền và trạng thái hoạt động.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateForm(EMPTY_EMPLOYEE_FORM);
            setCreateErrors({});
            setShowCreateModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
        >
          <span>➕</span>
          <span>Thêm nhân viên mới</span>
        </button>
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, email, số điện thoại..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>

        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="">Tất cả vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="staff">Nhân viên</option>
            <option value="customer">Khách hàng</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Tạm ngưng</option>
            <option value="locked">Đã khóa</option>
          </select>
        </div>
      </div>

      {/* Danh sách người dùng */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
          Không tìm thấy tài khoản nào phù hợp với điều kiện tìm kiếm.
        </div>
      ) : (
        <>
          {/* Bảng trên màn hình máy tính */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-900 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Người dùng</th>
                  <th className="px-4 py-3 font-semibold">Liên hệ</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Chuyên môn / Ghi chú</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const roleBadge = ROLE_BADGE[u.role_name] || { bg: 'bg-gray-100', label: u.role_name };
                  const statusBadge = STATUS_BADGE[u.status] || { bg: 'bg-gray-100', label: u.status };
                  const isSelf = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0 overflow-hidden">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              u.full_name?.[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 flex items-center gap-1.5">
                              {u.full_name}
                              {isSelf && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.2 rounded">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">
                              ID: #{u.id} {u.gender ? `• ${u.gender === 'male' ? 'Nam' : u.gender === 'female' ? 'Nữ' : 'Khác'}` : ''}
                              {u.birth_year ? ` • ${u.birth_year}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-gray-900">{u.email}</div>
                        <div className="text-xs text-gray-500">{u.phone || 'Chưa có SĐT'}</div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadge.bg}`}>
                          {roleBadge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-xs">
                        {u.role_name === 'staff' ? (
                          <div>
                            <span className="font-medium text-purple-900">{u.specialty || 'Chưa phân chuyên môn'}</span>
                            <div className="text-gray-400">
                              {u.experience_years ? `${u.experience_years} năm kinh nghiệm` : 'Chưa cập nhật kinh nghiệm'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg}`}>
                          {statusBadge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Sửa thông tin"
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResettingUser(u);
                              setNewPassword('');
                              setResetError('');
                            }}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Đặt lại mật khẩu"
                          >
                            🔑
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.status === 'active'
                                  ? 'text-gray-600 hover:text-red-600 hover:bg-red-50'
                                  : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                              }`}
                              title={u.status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            >
                              {u.status === 'active' ? '🔒' : '🔓'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Dạng thẻ trên điện thoại */}
          <div className="md:hidden space-y-3">
            {users.map((u) => {
              const roleBadge = ROLE_BADGE[u.role_name] || { bg: 'bg-gray-100', label: u.role_name };
              const statusBadge = STATUS_BADGE[u.status] || { bg: 'bg-gray-100', label: u.status };
              const isSelf = currentUser?.id === u.id;

              return (
                <div key={u.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold shrink-0 overflow-hidden">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          u.full_name?.[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                          {u.full_name}
                          {isSelf && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.2 rounded">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge.bg}`}>
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                    <div>
                      <span className="text-gray-400">SĐT: </span>
                      {u.phone || 'Chưa có'}
                    </div>
                    <div>
                      <span className="text-gray-400">Vai trò: </span>
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${roleBadge.bg}`}>{roleBadge.label}</span>
                    </div>
                    {u.role_name === 'staff' && (
                      <div className="col-span-2 text-purple-900">
                        <span className="text-gray-400">Chuyên môn: </span>
                        {u.specialty || 'Chưa phân'} • {u.experience_years ? `${u.experience_years} năm` : '1 năm'}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      ✏️ Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResettingUser(u);
                        setNewPassword('');
                        setResetError('');
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                    >
                      🔑 Đổi MK
                    </button>
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                          u.status === 'active'
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {u.status === 'active' ? '🔒 Khóa' : '🔓 Mở khóa'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phân trang */}
          {pagination.total_pages > 1 && (
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-200 text-sm">
              <span className="text-gray-500">
                Hiển thị trang {pagination.page} / {pagination.total_pages} (Tổng {pagination.total} người dùng)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchUsers(pagination.page - 1)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => fetchUsers(pagination.page + 1)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Thêm nhân viên mới */}
      {showCreateModal && (
        <Modal title="Thêm nhân viên mới" onClose={() => setShowCreateModal(false)} width="max-w-xl">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  className={inputClass(createErrors.full_name)}
                />
                {createErrors.full_name && (
                  <p className="text-xs text-red-500 mt-0.5">{createErrors.full_name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="nhanvien@petspa.vn"
                  className={inputClass(createErrors.email)}
                />
                {createErrors.email && (
                  <p className="text-xs text-red-500 mt-0.5">{createErrors.email}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Số điện thoại <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="0912345678"
                  className={inputClass(createErrors.phone)}
                />
                {createErrors.phone && (
                  <p className="text-xs text-red-500 mt-0.5">{createErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mật khẩu tạm <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Tối thiểu 8 ký tự (chữ + số)"
                  className={inputClass(createErrors.password)}
                />
                {createErrors.password && (
                  <p className="text-xs text-red-500 mt-0.5">{createErrors.password}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Giới tính</label>
                <select
                  value={createForm.gender}
                  onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}
                  className={inputClass(createErrors.gender)}
                >
                  <option value="">Chưa chọn</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Năm sinh</label>
                <input
                  type="number"
                  min="1940"
                  max={new Date().getFullYear()}
                  value={createForm.birth_year}
                  onChange={(e) => setCreateForm({ ...createForm, birth_year: e.target.value })}
                  placeholder="VD: 1998"
                  className={inputClass(createErrors.birth_year)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Địa chỉ liên hệ"
                  className={inputClass(createErrors.address)}
                />
              </div>

              <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">
                  Thông tin chuyên môn Spa
                </h3>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Chuyên môn chính</label>
                <input
                  type="text"
                  value={createForm.specialty}
                  onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })}
                  placeholder="VD: Cắt tỉa tạo kiểu, Tắm trị liệu..."
                  className={inputClass(createErrors.specialty)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Số năm kinh nghiệm</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  value={createForm.experience_years}
                  onChange={(e) => setCreateForm({ ...createForm, experience_years: e.target.value })}
                  className={inputClass(createErrors.experience_years)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ngày bắt đầu vào làm <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={createForm.hire_date}
                  onChange={(e) => setCreateForm({ ...createForm, hire_date: e.target.value })}
                  className={inputClass(createErrors.hire_date)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingCreate}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingCreate ? 'Đang tạo...' : 'Tạo nhân viên'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Sửa thông tin tài khoản */}
      {editingUser && (
        <Modal title={`Sửa thông tin: ${editingUser.full_name}`} onClose={() => setEditingUser(null)} width="max-w-lg">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className={inputClass(editErrors.full_name)}
                />
                {editErrors.full_name && (
                  <p className="text-xs text-red-500 mt-0.5">{editErrors.full_name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className={inputClass(editErrors.phone)}
                />
                {editErrors.phone && <p className="text-xs text-red-500 mt-0.5">{editErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Giới tính</label>
                <select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                  className={inputClass(editErrors.gender)}
                >
                  <option value="">Chưa chọn</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Năm sinh</label>
                <input
                  type="number"
                  min="1940"
                  max={new Date().getFullYear()}
                  value={editForm.birth_year}
                  onChange={(e) => setEditForm({ ...editForm, birth_year: e.target.value })}
                  className={inputClass(editErrors.birth_year)}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className={inputClass(editErrors.address)}
                />
              </div>

              {editingUser.role_name === 'staff' && (
                <>
                  <div className="sm:col-span-2 border-t border-gray-100 pt-3">
                    <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider mb-2">
                      Thông tin nhân viên
                    </h3>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Chuyên môn</label>
                    <input
                      type="text"
                      value={editForm.specialty}
                      onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                      className={inputClass(editErrors.specialty)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Số năm kinh nghiệm</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="60"
                      value={editForm.experience_years}
                      onChange={(e) => setEditForm({ ...editForm, experience_years: e.target.value })}
                      className={inputClass(editErrors.experience_years)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Đặt lại mật khẩu */}
      {resettingUser && (
        <Modal title={`Đặt lại mật khẩu cho ${resettingUser.full_name}`} onClose={() => setResettingUser(null)} width="max-w-md">
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <p className="text-xs text-gray-500">
              Sau khi đặt lại, tất cả phiên đăng nhập cũ của tài khoản <strong>{resettingUser.email}</strong> sẽ bị vô hiệu hóa ngay lập tức.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Mật khẩu mới <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setResetError('');
                }}
                placeholder="Tối thiểu 8 ký tự, có chữ và số"
                className={inputClass(Boolean(resetError))}
              />
              {resetError && <p className="text-xs text-red-500 mt-1">{resetError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setResettingUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingReset ? 'Đang cập nhật...' : 'Xác nhận đặt lại'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default UsersManagePage;

