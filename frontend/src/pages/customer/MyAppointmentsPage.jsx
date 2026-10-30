import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../api/axiosClient'
import StatusBadge from '../../components/StatusBadge'
import AppointmentDetailModal from '../../components/AppointmentDetailModal'
import CancelModal from '../../components/CancelModal'
import RescheduleModal from '../../components/RescheduleModal'
import PetAvatar from '../../components/PetAvatar'
import { ListSkeleton } from '../../components/Skeleton'
import { errorMessage } from '../../utils/format'
import { ACTIVE_STATUSES, customerCanChange, formatDate, hm } from '../../utils/appointment'

const TABS = [
  { key: 'upcoming', label: 'Sắp tới' },
  { key: 'history', label: 'Lịch sử' },
]

/**
 * MyAppointmentsPage: "Lịch hẹn của tôi" (khách hàng)
 * Xem lịch sắp tới / lịch sử, xem chi tiết, đổi lịch, hủy lịch (còn ≥ 2 giờ).
 */
const MyAppointmentsPage = () => {
  const [items, setItems] = useState([])
  const [tab, setTab] = useState('upcoming')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reschedTarget, setReschedTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.get('/appointments', { params: { limit: 100 } })
      setItems(res.data.data.appointments)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách lịch hẹn.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const upcoming = items.filter((a) => ACTIVE_STATUSES.includes(a.status))
    if (tab === 'upcoming') {
      return upcoming.sort((a, b) => `${a.appointment_date} ${a.start_time}`.localeCompare(`${b.appointment_date} ${b.start_time}`))
    }
    return items.filter((a) => !ACTIVE_STATUSES.includes(a.status))
  }, [items, tab])

  // Đổi lịch cần danh sách dịch vụ → lấy chi tiết trước khi mở hộp thoại
  const openReschedule = async (apt) => {
    try {
      const res = await axiosClient.get(`/appointments/${apt.id}`)
      setReschedTarget(res.data.data)
    } catch (err) {
      setError(errorMessage(err, 'Không mở được màn hình đổi lịch.'))
    }
  }

  const afterChange = () => { setCancelTarget(null); setReschedTarget(null); setDetailId(null); load() }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch hẹn của tôi</h1>
          <p className="text-sm text-gray-500 mt-1">Hủy hoặc đổi lịch được khi còn ít nhất 2 giờ trước giờ hẹn.</p>
        </div>
        <Link to="/booking" className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700">+ Đặt lịch mới</Link>
      </div>

      <div className="flex gap-1 border-b border-gray-200" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === t.key ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : shown.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">
          {tab === 'upcoming' ? 'Bạn chưa có lịch hẹn sắp tới.' : 'Chưa có lịch sử lịch hẹn.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((a) => {
            const canChange = customerCanChange(a)
            const changeable = ['pending', 'confirmed'].includes(a.status)
            return (
              <li key={a.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start gap-3">
                  <PetAvatar pet={{ name: a.pet_name, species: a.pet_species, avatar_url: a.pet_avatar }} size="w-12 h-12" text="text-xl" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900 truncate">{a.pet_name}</p>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-sm text-gray-700 mt-1">🗓 {hm(a.start_time)} – {hm(a.end_time)} · {formatDate(a.appointment_date)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Mã {a.appointment_code} · {a.employee_name ? `NV: ${a.employee_name}` : 'Chưa phân công nhân viên'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                  <button type="button" onClick={() => setDetailId(a.id)} className="px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Chi tiết</button>
                  {changeable && (
                    <>
                      <button type="button" disabled={!canChange} onClick={() => openReschedule(a)}
                        title={canChange ? '' : 'Còn dưới 2 giờ: vui lòng liên hệ trực tiếp spa'}
                        className="px-3 py-1.5 rounded-lg text-sm text-pink-700 bg-pink-50 hover:bg-pink-100 disabled:opacity-40 disabled:cursor-not-allowed">Đổi lịch</button>
                      <button type="button" disabled={!canChange} onClick={() => setCancelTarget(a)}
                        title={canChange ? '' : 'Còn dưới 2 giờ: vui lòng liên hệ trực tiếp spa'}
                        className="px-3 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed">Hủy lịch</button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {detailId && <AppointmentDetailModal id={detailId} onClose={() => setDetailId(null)} />}
      {cancelTarget && <CancelModal appointment={cancelTarget} onClose={() => setCancelTarget(null)} onDone={afterChange} />}
      {reschedTarget && <RescheduleModal appointment={reschedTarget} onClose={() => setReschedTarget(null)} onDone={afterChange} />}
    </div>
  )
}

export default MyAppointmentsPage
