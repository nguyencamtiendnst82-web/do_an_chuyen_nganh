import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../contexts/AuthContext'
import { useToast, useConfirm } from '../../components/Feedback'
import StatusBadge from '../../components/StatusBadge'
import AppointmentDetailModal from '../../components/AppointmentDetailModal'
import CancelModal from '../../components/CancelModal'
import RescheduleModal from '../../components/RescheduleModal'
import ChangeRequestModal from '../../components/ChangeRequestModal'
import CareStepModal from '../../components/CareStepModal'
import PetAvatar from '../../components/PetAvatar'
import { ListSkeleton } from '../../components/Skeleton'
import { errorMessage } from '../../utils/format'
import { NEXT_ACTION, STATUS_LABEL, todayStr, addDays, formatDate, hm } from '../../utils/appointment'
import { PAYMENT_STATUS_LABEL, PAYMENT_STATUS_STYLE } from '../../utils/invoice'
import CreateInvoiceModal from '../../components/CreateInvoiceModal'
import InvoiceDetailModal from '../../components/InvoiceDetailModal'

const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * AppointmentsManagePage: quản lý lịch hẹn.
 * Nhân viên: xác nhận, tiếp nhận, bắt đầu, hoàn tất; gán nhân viên; đổi, hủy lịch (không đặt hộ khách).
 * Admin: chỉ xem (lọc, tìm kiếm, chi tiết, hóa đơn), không chỉnh sửa lịch hẹn.
 */
const AppointmentsManagePage = () => {
  const { user } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()
  const isStaff = user?.role_name === 'staff'
  // Nhân viên chỉ thao tác lịch của mình; admin (chủ cửa hàng) chỉ xem, không can thiệp lịch hẹn
  const canAct = (apt) => isStaff && apt.employee_user_id === user?.id

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
  const [careTarget, setCareTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reschedTarget, setReschedTarget] = useState(null)
  const [changeTarget, setChangeTarget] = useState(null)
  const [employees, setEmployees] = useState([])
  const [assignId, setAssignId] = useState('')
  const [invoiceTarget, setInvoiceTarget] = useState(null)
  const [invoiceDetailId, setInvoiceDetailId] = useState(null)

  const openCreateInvoice = async (apt) => {
    try {
      const res = await axiosClient.get(`/appointments/${apt.id}`)
      setInvoiceTarget(res.data.data)
    } catch (err) {
      toast.error(errorMessage(err, 'Không tải được chi tiết lịch hẹn để lập hóa đơn.'))
    }
  }

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
    // Tiếp nhận và hoàn tất cần ghi chú / ảnh nên mở form riêng
    if (next.kind === 'checkin' || next.kind === 'complete') {
      setCareTarget({ apt, mode: next.kind })
      return
    }
    setBusyId(apt.id)
    try {
      if (next.kind === 'confirm') await axiosClient.patch(`/appointments/${apt.id}/confirm`)
      else await axiosClient.patch(`/appointments/${apt.id}/start`)
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

  const afterChange = () => { setCancelTarget(null); setReschedTarget(null); load() }

  const markNoShow = async (apt) => {
    if (!window.confirm(`Đánh dấu khách không đến cho lịch ${apt.appointment_code || '#' + apt.id}?`)) return
    try {
      await axiosClient.patch(`/appointments/${apt.id}/status`, { status: 'no_show' })
      toast.success('Đã đánh dấu khách không đến.')
      setDetailId(null)
      load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể đánh dấu khách không đến.'))
    }
  }

  const pastStart = (apt) => {
    const t = new Date(`${String(apt.appointment_date).slice(0, 10)}T${String(apt.start_time).slice(0, 5)}:00`)
    return t.getTime() <= Date.now()
  }

  const renderActions = (apt, reload) => {
    const open = !['completed', 'cancelled', 'no_show'].includes(apt.status)
    if (!open || !isStaff) return null
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
        {apt.status === 'confirmed' && pastStart(apt) && (
          <button type="button" onClick={() => markNoShow(apt)} className="px-3 py-2 rounded-lg text-sm text-orange-700 bg-orange-50 hover:bg-orange-100">Khách không đến</button>
        )}
        {canMove && (
          <button type="button" onClick={() => { setDetailId(null); setChangeTarget(apt) }} className="px-3 py-2 rounded-lg text-sm text-amber-700 bg-amber-50 hover:bg-amber-100">Báo bận / đề xuất đổi</button>
        )}
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
          <p className="text-sm text-gray-500 mt-0.5">
            {pagination.total} lịch hẹn{!isStaff && ' · Chế độ xem (quản trị viên không chỉnh sửa lịch hẹn)'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input id="f-date" type="date" value={date} disabled={allDates} onChange={resetPage(setDate)} aria-label="Ngày"
            className={`${selectClass} disabled:bg-gray-100`} />
          <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
            <input type="checkbox" checked={allDates} onChange={(e) => { setAllDates(e.target.checked); setPage(1) }} className="accent-blue-600" />
            ±30 ngày
          </label>
          <input id="f-search" type="search" value={search} onChange={resetPage(setSearch)} aria-label="Tìm kiếm"
            placeholder="Tìm mã lịch, khách, SĐT, thú cưng..." className={`${selectClass} flex-1 min-w-[200px]`} />
          {isStaff && (
            <label className="flex items-center gap-2 text-sm text-gray-600 px-1">
              <input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(1) }} className="accent-blue-600" />
              Chỉ lịch của tôi
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo trạng thái">
          {[['', 'Tất cả'], ...Object.entries(STATUS_LABEL)].map(([k, v]) => (
            <button key={k || 'all'} type="button" onClick={() => { setStatus(k); setPage(1) }} aria-pressed={status === k}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${status === k
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{v}</button>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">Không có lịch hẹn nào.</div>
      ) : (
        <>
          {/* Máy tính: bảng gọn */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Giờ hẹn</th>
                  <th className="text-left font-medium px-4 py-2.5">Thú cưng / Khách</th>
                  <th className="text-left font-medium px-4 py-2.5">Nhân viên</th>
                  <th className="text-left font-medium px-4 py-2.5">Trạng thái</th>
                  <th className="text-right font-medium px-4 py-2.5">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((a) => {
                  const next = NEXT_ACTION[a.status]
                  return (
                    <tr key={a.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-medium text-gray-900">{hm(a.start_time)} – {hm(a.end_time)}</p>
                        <p className="text-xs text-gray-500">{formatDate(a.appointment_date)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <PetAvatar pet={{ name: a.pet_name, species: a.pet_species, avatar_url: a.pet_avatar }} size="w-9 h-9" text="text-base" />
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{a.pet_name}</p>
                            <p className="text-xs text-gray-500 truncate">{a.customer_name} · <span className="font-mono">{a.appointment_code}</span></p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{a.employee_name || <span className="text-gray-400">Chưa phân công</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={a.status} />
                          {a.status === 'completed' && a.invoice_id && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${PAYMENT_STATUS_STYLE[a.invoice_payment_status] || 'bg-gray-100 text-gray-700'}`}>
                              {PAYMENT_STATUS_LABEL[a.invoice_payment_status] || a.invoice_payment_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {next && canAct(a) && (
                            <button type="button" disabled={busyId === a.id} onClick={() => advance(a)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
                              {busyId === a.id ? '...' : next.label}
                            </button>
                          )}
                          {a.status === 'completed' && !a.invoice_id && canAct(a) && (
                            <button type="button" onClick={() => openCreateInvoice(a)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700">+ Lập hóa đơn</button>
                          )}
                          {a.status === 'completed' && a.invoice_id && (
                            <button type="button" onClick={() => setInvoiceDetailId(a.invoice_id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-50">Hóa đơn</button>
                          )}
                          <button type="button" onClick={() => setDetailId(a.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">Chi tiết</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: thẻ */}
          <ul className="md:hidden space-y-2">
            {items.map((a) => {
              const next = NEXT_ACTION[a.status]
              return (
                <li key={a.id} className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <PetAvatar pet={{ name: a.pet_name, species: a.pet_species, avatar_url: a.pet_avatar }} size="w-10 h-10" text="text-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-900 truncate">{a.pet_name} <span className="text-gray-400 font-normal">· {a.customer_name}</span></p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-sm text-gray-600">{hm(a.start_time)} – {hm(a.end_time)} · {formatDate(a.appointment_date)}</p>
                      <p className="text-xs text-gray-500"><span className="font-mono">{a.appointment_code}</span> · {a.employee_name || 'Chưa phân công'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {a.status === 'completed' && a.invoice_id && (
                      <span className={`mr-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${PAYMENT_STATUS_STYLE[a.invoice_payment_status] || 'bg-gray-100 text-gray-700'}`}>
                        {PAYMENT_STATUS_LABEL[a.invoice_payment_status] || a.invoice_payment_status}
                      </span>
                    )}
                    {next && canAct(a) && (
                      <button type="button" disabled={busyId === a.id} onClick={() => advance(a)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 disabled:opacity-60">{busyId === a.id ? '...' : next.label}</button>
                    )}
                    {a.status === 'completed' && !a.invoice_id && canAct(a) && (
                      <button type="button" onClick={() => openCreateInvoice(a)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-600">+ Lập hóa đơn</button>
                    )}
                    {a.status === 'completed' && a.invoice_id && (
                      <button type="button" onClick={() => setInvoiceDetailId(a.invoice_id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 border border-emerald-200">Hóa đơn</button>
                    )}
                    <button type="button" onClick={() => setDetailId(a.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200">Chi tiết</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
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
      {changeTarget && <ChangeRequestModal appointment={changeTarget} onClose={() => setChangeTarget(null)} />}
      {cancelTarget && <CancelModal appointment={cancelTarget} onClose={() => setCancelTarget(null)} onDone={afterChange} />}
      {reschedTarget && <RescheduleModal appointment={reschedTarget} accent="blue" onClose={() => setReschedTarget(null)} onDone={afterChange} />}
      {careTarget && (
        <CareStepModal
          appointment={careTarget.apt}
          mode={careTarget.mode}
          onClose={() => setCareTarget(null)}
          onDone={() => { setCareTarget(null); load() }}
        />
      )}
      {invoiceTarget && (
        <CreateInvoiceModal
          appointment={invoiceTarget}
          onClose={() => setInvoiceTarget(null)}
          onSuccess={() => {
            setInvoiceTarget(null);
            load();
          }}
        />
      )}
      {invoiceDetailId && (
        <InvoiceDetailModal
          invoiceId={invoiceDetailId}
          onClose={() => setInvoiceDetailId(null)}
          onUpdated={load}
        />
      )}
    </div>
  )
}

export default AppointmentsManagePage
