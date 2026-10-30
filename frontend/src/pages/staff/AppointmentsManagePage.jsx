import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../contexts/AuthContext'
import { useToast, useConfirm } from '../../components/Feedback'
import StatusBadge from '../../components/StatusBadge'
import AppointmentDetailModal from '../../components/AppointmentDetailModal'
import CancelModal from '../../components/CancelModal'
import RescheduleModal from '../../components/RescheduleModal'
import StaffBookingModal from '../../components/StaffBookingModal'
import PetAvatar from '../../components/PetAvatar'
import { ListSkeleton } from '../../components/Skeleton'
import { errorMessage } from '../../utils/format'
import { NEXT_ACTION, STATUS_LABEL, todayStr, addDays, formatDate, hm } from '../../utils/appointment'

const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * AppointmentsManagePage: quản lý lịch hẹn cho nhân viên và admin.
 * Lọc theo ngày / trạng thái / từ khóa; xác nhận, tiếp nhận, bắt đầu, hoàn tất; gán nhân viên; đổi, hủy lịch; đặt hộ khách.
 */
const AppointmentsManagePage = () => {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isStaff = user?.role_name === 'staff'
  // Nhân viên chỉ thao tác lịch của mình; admin thao tác mọi lịch
  const canAct = (apt) => !isStaff || apt.employee_user_id === user?.id

  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [date, setDate] = useState(todayStr())
  const [allDates, setAllDates] = useState(false)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [mine, setMine] = useState(false)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [detailId, setDetailId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reschedTarget, setReschedTarget] = useState(null)
  const [showBooking, setShowBooking] = useState(false)
  const [employees, setEmployees] = useState([])
  const [assignId, setAssignId] = useState('')

  useEffect(() => {
    axiosClient.get('/employees')
      .then((res) => { const d = res.data.data; setEmployees(Array.isArray(d) ? d : d.employees || []) })
      .catch(() => setEmployees([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {
        page, limit: 10,
        status: status || undefined,
        search: search.trim() || undefined,
        my: isStaff && mine ? 'true' : undefined,
      }
      if (allDates) { params.from = addDays(todayStr(), -30); params.to = addDays(todayStr(), 30) } else { params.date = date }
      const res = await axiosClient.get('/appointments', { params })
      setItems(res.data.data.appointments)
      setPagination(res.data.data.pagination)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách lịch hẹn.'))
    } finally {
      setLoading(false)
    }
  }, [page, status, search, mine, isStaff, allDates, date])

  useEffect(() => {
    const timer = setTimeout(load, 250) // chờ người dùng ngừng gõ ô tìm kiếm
    return () => clearTimeout(timer)
  }, [load])

  const resetPage = (setter) => (e) => { setter(e.target.value); setPage(1) }

  const advance = async (apt) => {
    const next = NEXT_ACTION[apt.status]
    if (!next) return
    if (next.status === 'completed') {
      const ok = await confirm({ title: 'Hoàn tất lịch hẹn?', message: `Xác nhận bé ${apt.pet_name} đã được phục vụ xong.`, confirmText: 'Hoàn tất' })
      if (!ok) return
    }
    setBusyId(apt.id)
    try {
      if (next.status === 'confirmed') await axiosClient.patch(`/appointments/${apt.id}/confirm`)
      else await axiosClient.patch(`/appointments/${apt.id}/status`, { status: next.status })
      toast.success(`${apt.appointment_code}: ${STATUS_LABEL[next.status]}.`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể đổi trạng thái.'))
    } finally {
      setBusyId(null)
    }
  }

  const assign = async (apt, reload) => {
    if (!assignId) return
    try {
      await axiosClient.patch(`/appointments/${apt.id}/assign`, { employeeId: Number(assignId) })
      toast.success('Đã phân công nhân viên.')
      setAssignId('')
      await reload()
      load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể phân công nhân viên.'))
    }
  }

  const openReschedule = async (apt) => {
    try {
      const res = await axiosClient.get(`/appointments/${apt.id}`)
      setDetailId(null)
      setReschedTarget(res.data.data)
    } catch (err) {
      toast.error(errorMessage(err, 'Không mở được màn hình đổi lịch.'))
    }
  }

  const afterChange = () => { setCancelTarget(null); setReschedTarget(null); setShowBooking(false); load() }

  const renderActions = (apt, reload) => {
    const open = !['completed', 'cancelled'].includes(apt.status)
    if (!open) return null
    if (!canAct(apt)) {
      return <p className="text-xs text-gray-500 mr-auto">Lịch này do nhân viên khác phụ trách, bạn chỉ xem được.</p>
    }
    const canMove = ['pending', 'confirmed'].includes(apt.status)
    return (
      <>
        <div className="flex gap-2 w-full sm:w-auto sm:mr-auto">
          <select value={assignId} onChange={(e) => setAssignId(e.target.value)} className={`${selectClass} flex-1 sm:flex-none`} aria-label="Chọn nhân viên để phân công">
            <option value="">Phân công cho...</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
          <button type="button" disabled={!assignId} onClick={() => assign(apt, reload)}
            className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50">Gán</button>
        </div>
        {canMove && (
          <>
            <button type="button" onClick={() => openReschedule(apt)} className="px-3 py-2 rounded-lg text-sm text-blue-700 bg-blue-50 hover:bg-blue-100">Đổi lịch</button>
            <button type="button" onClick={() => { setDetailId(null); setCancelTarget(apt) }} className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">Hủy lịch</button>
          </>
        )}
      </>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý lịch hẹn</h1>
          <p className="text-sm text-gray-500 mt-1">{pagination.total} lịch hẹn theo bộ lọc hiện tại.</p>
        </div>
        <button type="button" onClick={() => setShowBooking(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">+ Đặt lịch hộ khách</button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="f-date" className="block text-xs text-gray-500 mb-1">Ngày</label>
          <input id="f-date" type="date" value={date} disabled={allDates} onChange={resetPage(setDate)} className={`${selectClass} disabled:bg-gray-100`} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
          <input type="checkbox" checked={allDates} onChange={(e) => { setAllDates(e.target.checked); setPage(1) }} className="accent-blue-600" />
          ±30 ngày
        </label>
        <div>
          <label htmlFor="f-status" className="block text-xs text-gray-500 mb-1">Trạng thái</label>
          <select id="f-status" value={status} onChange={resetPage(setStatus)} className={selectClass}>
            <option value="">Tất cả</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="f-search" className="block text-xs text-gray-500 mb-1">Tìm kiếm</label>
          <input id="f-search" type="search" value={search} onChange={resetPage(setSearch)} placeholder="Mã lịch, tên khách, SĐT, tên thú cưng..."
            className={`${selectClass} w-full`} />
        </div>
        {isStaff && (
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1) }} className="accent-blue-600" />
            Chỉ lịch của tôi
          </label>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">Không có lịch hẹn nào.</div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {items.map((a) => {
            const next = NEXT_ACTION[a.status]
            return (
              <li key={a.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <PetAvatar pet={{ name: a.pet_name, species: a.pet_species, avatar_url: a.pet_avatar }} size="w-11 h-11" text="text-xl" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {a.pet_name} <span className="text-gray-400 font-normal">· {a.customer_name}</span>
                    </p>
                    <p className="text-sm text-gray-600">{hm(a.start_time)} – {hm(a.end_time)} · {formatDate(a.appointment_date)}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{a.appointment_code}</span> · {a.employee_name ? `NV: ${a.employee_name}` : 'Chưa phân công'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-between sm:justify-end">
                  <StatusBadge status={a.status} />
                  <button type="button" onClick={() => setDetailId(a.id)} className="px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Chi tiết</button>
                  {next && canAct(a) && (
                    <button type="button" disabled={busyId === a.id} onClick={() => advance(a)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                      {busyId === a.id ? '...' : next.label}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">Trước</button>
          <span className="text-gray-600">Trang {pagination.page} / {pagination.total_pages}</span>
          <button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">Sau</button>
        </div>
      )}

      {detailId && (
        <AppointmentDetailModal id={detailId} staffMode onClose={() => setDetailId(null)} renderActions={renderActions} onChanged={load} />
      )}
      {cancelTarget && <CancelModal appointment={cancelTarget} onClose={() => setCancelTarget(null)} onDone={afterChange} />}
      {reschedTarget && <RescheduleModal appointment={reschedTarget} accent="blue" onClose={() => setReschedTarget(null)} onDone={afterChange} />}
      {showBooking && <StaffBookingModal onClose={() => setShowBooking(false)} onDone={afterChange} />}
    </div>
  )
}

export default AppointmentsManagePage
