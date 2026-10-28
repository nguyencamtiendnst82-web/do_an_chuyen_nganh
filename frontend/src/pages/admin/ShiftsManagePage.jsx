import { useCallback, useEffect, useState } from 'react';
import shiftApi from '../../api/shiftApi';
import employeeApi from '../../api/employeeApi';
import Modal from '../../components/Modal';
import { TableSkeleton } from '../../components/Skeleton';
import { useToast, useConfirm } from '../../components/Feedback';
import { errorMessage, mapFieldErrors } from '../../utils/format';

const WEEKDAYS = [
  { val: 1, label: 'Thứ 2' },
  { val: 2, label: 'Thứ 3' },
  { val: 3, label: 'Thứ 4' },
  { val: 4, label: 'Thứ 5' },
  { val: 5, label: 'Thứ 6' },
  { val: 6, label: 'Thứ 7' },
  { val: 0, label: 'Chủ nhật' },
];

const EMPTY_SHIFT_FORM = {
  shift_name: '',
  start_time: '08:00',
  end_time: '12:00',
  description: '',
  is_active: true,
};

const inputClass = (hasError) =>
  `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
    hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`;

/**
 * Format string YYYY-MM-DD -> DD/MM/YYYY
 */
const formatDateVN = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Lấy ngày đầu tuần (Thứ 2) từ một ngày cho trước
 */
const getMonday = (d) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
};

/**
 * Cộng thêm số ngày vào YYYY-MM-DD
 */
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const ShiftsManagePage = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'templates'
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // State cho Tab Lịch tuần
  const [currentMonday, setCurrentMonday] = useState(getMonday(new Date()));
  const [scheduleData, setScheduleData] = useState({ shifts: [], records: [] });
  const [filterEmployeeId, setFilterEmployeeId] = useState('');

  // Modal phân ca hàng loạt
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    employee_id: '',
    shift_ids: [],
    from: new Date().toISOString().slice(0, 10),
    to: addDays(new Date().toISOString().slice(0, 10), 6),
    weekdays: [1, 2, 3, 4, 5, 6, 0],
  });
  const [bulkErrors, setBulkErrors] = useState({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Modal ca mẫu (Thêm / Sửa)
  const [editingShift, setEditingShift] = useState(null); // null = đóng, {} = thêm mới, object = sửa
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT_FORM);
  const [shiftErrors, setShiftErrors] = useState({});
  const [savingShift, setSavingShift] = useState(false);

  // Tải danh sách ca mẫu & danh sách nhân viên
  const loadBaseData = useCallback(async () => {
    try {
      const [shiftsRes, empRes] = await Promise.all([
        shiftApi.listShifts({ all: 'true' }),
        employeeApi.listEmployees({ scope: 'admin' }),
      ]);
      setShifts(shiftsRes.data.data);
      // Chỉ lấy nhân viên đang active để phân ca
      setEmployees(empRes.data.data.filter((e) => e.status === 'active' && e.user_status === 'active'));
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể tải dữ liệu cơ bản.'));
    }
  }, [toast]);

  // Tải lịch phân ca của tuần hiện tại
  const loadSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const sunday = addDays(currentMonday, 6);
      const res = await shiftApi.listEmployeeShifts({
        from: currentMonday,
        to: sunday,
        employee_id: filterEmployeeId || undefined,
      });
      setScheduleData(res.data.data);
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể tải lịch phân ca.'));
    } finally {
      setLoading(false);
    }
  }, [currentMonday, filterEmployeeId, toast]);

  useEffect(() => {
    loadBaseData();
  }, [loadBaseData]);

  useEffect(() => {
    if (activeTab === 'schedule') {
      loadSchedule();
    } else {
      setLoading(false);
    }
  }, [activeTab, loadSchedule]);

  // Điều hướng tuần
  const handlePrevWeek = () => setCurrentMonday(addDays(currentMonday, -7));
  const handleNextWeek = () => setCurrentMonday(addDays(currentMonday, 7));
  const handleCurrentWeek = () => setCurrentMonday(getMonday(new Date()));

  // Xóa một lượt phân ca
  const handleDeleteAssignment = async (record) => {
    const confirmed = await confirm({
      title: 'Xóa phân ca?',
      message: `Xóa phân ca của nhân viên "${record.full_name}" trong "${record.shift_name}" ngày ${formatDateVN(
        record.work_date
      )}?`,
      confirmText: 'Xóa phân ca',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await shiftApi.deleteEmployeeShift(record.id);
      toast.success('Đã xóa phân ca thành công.');
      loadSchedule();
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể xóa phân ca.'));
    }
  };

  // Submit phân ca hàng loạt
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkErrors({});
    if (bulkForm.shift_ids.length === 0) {
      setBulkErrors({ shift_ids: 'Vui lòng chọn ít nhất một ca làm việc.' });
      return;
    }
    setSavingBulk(true);
    try {
      const payload = {
        employee_id: Number(bulkForm.employee_id),
        shift_ids: bulkForm.shift_ids.map(Number),
        from: bulkForm.from,
        to: bulkForm.to,
        weekdays: bulkForm.weekdays.length > 0 ? bulkForm.weekdays.map(Number) : undefined,
      };

      const res = await shiftApi.bulkAssign(payload);
      setBulkResult(res.data.data);
      toast.success(`Đã phân công ${res.data.data.created} ca làm việc.`);
      loadSchedule();
    } catch (err) {
      const fieldErrs = mapFieldErrors(err);
      if (fieldErrs) {
        setBulkErrors(fieldErrs);
      } else {
        toast.error(errorMessage(err, 'Phân ca thất bại.'));
      }
    } finally {
      setSavingBulk(false);
    }
  };

  // Mở modal thêm/sửa ca mẫu
  const openShiftModal = (s = null) => {
    setEditingShift(s || {});
    if (s) {
      setShiftForm({
        shift_name: s.shift_name,
        start_time: s.start_time?.slice(0, 5) || '08:00',
        end_time: s.end_time?.slice(0, 5) || '12:00',
        description: s.description || '',
        is_active: Boolean(s.is_active),
      });
    } else {
      setShiftForm(EMPTY_SHIFT_FORM);
    }
    setShiftErrors({});
  };

  // Submit lưu ca mẫu
  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    setShiftErrors({});
    setSavingShift(true);
    try {
      if (editingShift?.id) {
        await shiftApi.updateShift(editingShift.id, shiftForm);
        toast.success('Cập nhật ca làm việc thành công.');
      } else {
        await shiftApi.createShift(shiftForm);
        toast.success('Tạo ca làm việc mới thành công.');
      }
      setEditingShift(null);
      loadBaseData();
    } catch (err) {
      const fieldErrs = mapFieldErrors(err);
      if (fieldErrs) {
        setShiftErrors(fieldErrs);
      } else {
        toast.error(errorMessage(err, 'Lưu ca làm việc thất bại.'));
      }
    } finally {
      setSavingShift(false);
    }
  };

  // Bật / Ẩn ca mẫu
  const handleToggleShiftActive = async (s) => {
    const isDeactivating = Boolean(s.is_active);
    const actionText = isDeactivating ? 'ẩn' : 'kích hoạt';

    const confirmed = await confirm({
      title: `${isDeactivating ? 'Ẩn' : 'Bật'} ca làm việc?`,
      message: `Bạn có chắc muốn ${actionText} "${s.shift_name}"?`,
      confirmText: isDeactivating ? 'Ẩn ca' : 'Bật ca',
      danger: isDeactivating,
    });
    if (!confirmed) return;

    try {
      await shiftApi.updateShift(s.id, { is_active: !s.is_active });
      toast.success(`Đã ${actionText} ca làm việc.`);
      loadBaseData();
    } catch (err) {
      toast.error(errorMessage(err, `Không thể ${actionText} ca làm việc.`));
    }
  };

  // Xóa ca mẫu
  const handleDeleteShift = async (s) => {
    const confirmed = await confirm({
      title: 'Xóa ca làm việc?',
      message: `Bạn có chắc muốn xóa vĩnh viễn "${s.shift_name}"? Thao tác này chỉ thực hiện được nếu ca chưa từng được phân công.`,
      confirmText: 'Xóa ca',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await shiftApi.deleteShift(s.id);
      toast.success('Đã xóa ca làm việc thành công.');
      loadBaseData();
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể xóa ca làm việc.'));
    }
  };

  // Tính các ngày trong tuần (Thứ 2 đến CN)
  const weekDaysList = Array.from({ length: 7 }).map((_, i) => {
    const dateStr = addDays(currentMonday, i);
    const weekdayObj = WEEKDAYS[i];
    return {
      dateStr,
      label: weekdayObj.label,
      displayDate: formatDateVN(dateStr),
      isToday: dateStr === new Date().toISOString().slice(0, 10),
    };
  });

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Chuyển Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Ca làm việc & Phân công</h1>
          <p className="text-sm text-gray-500 mt-1">
            Thiết lập ca mẫu và phân ca hàng tuần cho đội ngũ nhân viên spa.
          </p>
        </div>

        {/* Nút hành động */}
        <div className="flex gap-2">
          {activeTab === 'schedule' ? (
            <button
              type="button"
              onClick={() => {
                setBulkResult(null);
                setBulkErrors({});
                setBulkForm({
                  employee_id: employees[0]?.id || '',
                  shift_ids: shifts.filter((s) => s.is_active).map((s) => s.id).slice(0, 1),
                  from: currentMonday,
                  to: addDays(currentMonday, 6),
                  weekdays: [1, 2, 3, 4, 5, 6, 0],
                });
                setShowBulkModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
            >
              <span>📅</span>
              <span>Phân ca hàng loạt</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openShiftModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition-colors text-sm"
            >
              <span>➕</span>
              <span>Thêm ca làm mẫu</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('schedule')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'schedule'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📅 Lịch phân ca tuần
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'templates'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          ⏰ Danh mục ca mẫu ({shifts.length})
        </button>
      </div>

      {/* NỘI DUNG TAB 1: LỊCH PHÂN CA TUẦN */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Thanh công cụ điều hướng tuần & lọc nhân viên */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevWeek}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                ← Tuần trước
              </button>
              <button
                type="button"
                onClick={handleCurrentWeek}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium"
              >
                Tuần này
              </button>
              <button
                type="button"
                onClick={handleNextWeek}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Tuần sau →
              </button>
            </div>

            <div className="text-sm font-semibold text-purple-900">
              Tuần: {formatDateVN(currentMonday)} – {formatDateVN(addDays(currentMonday, 6))}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-gray-500 whitespace-nowrap">Lọc nhân viên:</span>
              <select
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
                className="w-full sm:w-48 px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Tất cả nhân viên</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : (
            <>
              {/* Bảng trên màn hình Desktop */}
              <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-800 text-xs uppercase tracking-wider">
                      <th className="p-3 border-r border-gray-200 w-44">Khung ca làm việc</th>
                      {weekDaysList.map((day) => (
                        <th
                          key={day.dateStr}
                          className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${
                            day.isToday ? 'bg-purple-50 text-purple-800 font-bold' : ''
                          }`}
                        >
                          <div>{day.label}</div>
                          <div className="text-[11px] font-normal text-gray-500">{day.displayDate}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    {shifts.map((shift) => (
                      <tr key={shift.id} className="hover:bg-gray-50/50">
                        <td className="p-3 border-r border-gray-200 bg-gray-50/30">
                          <div className="font-semibold text-gray-900">{shift.shift_name}</div>
                          <div className="text-xs text-purple-700 font-medium">
                            {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                          </div>
                          {!shift.is_active && (
                            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.2 rounded mt-1 inline-block">
                              Đã ẩn
                            </span>
                          )}
                        </td>

                        {weekDaysList.map((day) => {
                          const assigned = scheduleData.records.filter(
                            (r) => r.shift_id === shift.id && r.work_date.slice(0, 10) === day.dateStr
                          );

                          return (
                            <td
                              key={day.dateStr}
                              className={`p-2 border-r border-gray-200 last:border-r-0 align-top ${
                                day.isToday ? 'bg-purple-50/20' : ''
                              }`}
                            >
                              <div className="space-y-1.5 min-h-[50px]">
                                {assigned.map((rec) => (
                                  <div
                                    key={rec.id}
                                    className="group flex items-center justify-between bg-purple-100 hover:bg-purple-200 text-purple-900 px-2 py-1 rounded text-xs transition-colors shadow-2xs"
                                  >
                                    <span className="truncate font-medium">{rec.full_name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAssignment(rec)}
                                      className="text-purple-400 hover:text-red-600 font-bold ml-1 px-1 rounded transition-colors"
                                      title="Xóa phân ca"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Danh sách theo ngày trên Mobile */}
              <div className="lg:hidden space-y-3">
                {weekDaysList.map((day) => {
                  const dayRecords = scheduleData.records.filter(
                    (r) => r.work_date.slice(0, 10) === day.dateStr
                  );

                  return (
                    <div
                      key={day.dateStr}
                      className={`p-4 rounded-xl border shadow-sm ${
                        day.isToday ? 'bg-purple-50/40 border-purple-300' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                        <div className="font-semibold text-gray-900">
                          {day.label} <span className="text-xs text-gray-500 font-normal">({day.displayDate})</span>
                        </div>
                        {day.isToday && (
                          <span className="text-xs bg-purple-600 text-white font-bold px-2 py-0.5 rounded-full">
                            Hôm nay
                          </span>
                        )}
                      </div>

                      {shifts.map((shift) => {
                        const assignedInShift = dayRecords.filter((r) => r.shift_id === shift.id);

                        return (
                          <div key={shift.id} className="py-2 border-b border-gray-50 last:border-none">
                            <div className="text-xs font-medium text-gray-700 flex justify-between">
                              <span>{shift.shift_name}</span>
                              <span className="text-purple-700">
                                {shift.start_time?.slice(0, 5)} - {shift.end_time?.slice(0, 5)}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {assignedInShift.length === 0 ? (
                                <span className="text-xs text-gray-400 italic">Chưa có ai</span>
                              ) : (
                                assignedInShift.map((rec) => (
                                  <span
                                    key={rec.id}
                                    className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 px-2 py-0.5 rounded text-xs"
                                  >
                                    <span>{rec.full_name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAssignment(rec)}
                                      className="text-purple-400 hover:text-red-600 font-bold"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* NỘI DUNG TAB 2: CA LÀM MẪU */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold">Tên ca làm việc</th>
                <th className="px-4 py-3 font-semibold">Khung giờ</th>
                <th className="px-4 py-3 font-semibold">Mô tả</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
                <th className="px-4 py-3 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shifts.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{s.shift_name}</td>
                  <td className="px-4 py-3 font-mono text-purple-700 font-medium">
                    {s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.description || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {s.is_active ? 'Đang bật' : 'Đang ẩn'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openShiftModal(s)}
                        className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Sửa ca"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleShiftActive(s)}
                        className={`p-1.5 rounded-lg ${
                          s.is_active
                            ? 'text-gray-600 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-600 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={s.is_active ? 'Ẩn ca' : 'Bật ca'}
                      >
                        {s.is_active ? '👁️' : '🙈'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(s)}
                        className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Xóa ca"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Thêm / Sửa ca làm mẫu */}
      {editingShift && (
        <Modal
          title={editingShift.id ? `Sửa ca: ${editingShift.shift_name}` : 'Thêm ca làm việc mẫu'}
          onClose={() => setEditingShift(null)}
          width="max-w-md"
        >
          <form onSubmit={handleShiftSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Tên ca làm việc <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={shiftForm.shift_name}
                onChange={(e) => setShiftForm({ ...shiftForm, shift_name: e.target.value })}
                placeholder="VD: Ca Sáng, Ca Chiều..."
                className={inputClass(shiftErrors.shift_name)}
              />
              {shiftErrors.shift_name && (
                <p className="text-xs text-red-500 mt-0.5">{shiftErrors.shift_name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Giờ bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  step="300"
                  required
                  value={shiftForm.start_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                  className={inputClass(shiftErrors.start_time)}
                />
                {shiftErrors.start_time && (
                  <p className="text-xs text-red-500 mt-0.5">{shiftErrors.start_time}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Giờ kết thúc <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  step="300"
                  required
                  value={shiftForm.end_time}
                  onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                  className={inputClass(shiftErrors.end_time)}
                />
                {shiftErrors.end_time && (
                  <p className="text-xs text-red-500 mt-0.5">{shiftErrors.end_time}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mô tả thêm</label>
              <textarea
                rows="2"
                value={shiftForm.description}
                onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                placeholder="Ghi chú thêm về ca làm này..."
                className={inputClass(shiftErrors.description)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active_check"
                checked={shiftForm.is_active}
                onChange={(e) => setShiftForm({ ...shiftForm, is_active: e.target.checked })}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="is_active_check" className="text-xs font-medium text-gray-700">
                Cho phép sử dụng ca này để phân công nhân viên
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={savingShift}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingShift ? 'Đang lưu...' : 'Lưu ca làm việc'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Phân ca hàng loạt */}
      {showBulkModal && (
        <Modal title="Phân ca làm việc hàng loạt" onClose={() => setShowBulkModal(false)} width="max-w-lg">
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Chọn nhân viên <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={bulkForm.employee_id}
                onChange={(e) => setBulkForm({ ...bulkForm, employee_id: e.target.value })}
                className={inputClass(bulkErrors.employee_id)}
              >
                <option value="">-- Chọn nhân viên --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.specialty || 'Chưa phân chuyên môn'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Chọn ca làm việc <span className="text-red-500">*</span>
              </label>
              <div className="space-y-1.5 p-3 border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                {shifts
                  .filter((s) => s.is_active)
                  .map((s) => {
                    const isChecked = bulkForm.shift_ids.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkForm({ ...bulkForm, shift_ids: [...bulkForm.shift_ids, s.id] });
                            } else {
                              setBulkForm({
                                ...bulkForm,
                                shift_ids: bulkForm.shift_ids.filter((id) => id !== s.id),
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-medium">{s.shift_name}</span>
                        <span className="text-purple-600">
                          ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                        </span>
                      </label>
                    );
                  })}
              </div>
              {bulkErrors.shift_ids && (
                <p className="text-xs text-red-500 mt-1">{bulkErrors.shift_ids}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Từ ngày</label>
                <input
                  type="date"
                  required
                  value={bulkForm.from}
                  onChange={(e) => setBulkForm({ ...bulkForm, from: e.target.value })}
                  className={inputClass(bulkErrors.from)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Đến ngày</label>
                <input
                  type="date"
                  required
                  value={bulkForm.to}
                  onChange={(e) => setBulkForm({ ...bulkForm, to: e.target.value })}
                  className={inputClass(bulkErrors.to)}
                />
                {bulkErrors.to && <p className="text-xs text-red-500 mt-0.5">{bulkErrors.to}</p>}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Áp dụng cho các thứ:</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((wd) => {
                  const isChecked = bulkForm.weekdays.includes(wd.val);
                  return (
                    <button
                      type="button"
                      key={wd.val}
                      onClick={() => {
                        const newWd = isChecked
                          ? bulkForm.weekdays.filter((v) => v !== wd.val)
                          : [...bulkForm.weekdays, wd.val];
                        setBulkForm({ ...bulkForm, weekdays: newWd });
                      }}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium border transition-colors ${
                        isChecked
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {wd.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Báo cáo kết quả phân ca */}
            {bulkResult && (
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs space-y-2">
                <div className="font-semibold text-green-700">
                  ✓ Đã tạo thành công: {bulkResult.created} ca
                </div>
                {bulkResult.skipped?.length > 0 && (
                  <div>
                    <div className="font-semibold text-amber-700 mb-1">
                      ⚠️ Bỏ qua {bulkResult.skipped.length} ca:
                    </div>
                    <div className="max-h-28 overflow-y-auto space-y-1 text-gray-600">
                      {bulkResult.skipped.map((sk, idx) => (
                        <div key={idx} className="flex justify-between border-b border-gray-100 py-0.5">
                          <span>
                            {formatDateVN(sk.date)}: {sk.shift_name || `Ca #${sk.shift_id}`}
                          </span>
                          <span className="text-red-500 font-medium">{sk.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={savingBulk}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {savingBulk ? 'Đang phân ca...' : 'Thực hiện phân ca'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default ShiftsManagePage;

