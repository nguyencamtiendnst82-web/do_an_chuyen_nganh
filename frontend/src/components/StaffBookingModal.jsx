import { useEffect, useMemo, useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import CustomerPicker from './CustomerPicker'
import SlotPicker from './SlotPicker'
import { useToast } from './Feedback'
import { formatVND, errorMessage, mapFieldErrors, SPECIES_LABEL } from '../utils/format'
import { todayStr, addDays, sumDuration, sumPrice } from '../utils/appointment'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

/**
 * StaffBookingModal: nhân viên / admin đặt lịch hộ khách (khách đến trực tiếp hoặc gọi điện).
 * Gửi customerId để server đặt lịch cho đúng khách; mọi quy tắc (ca làm, trùng giờ, SĐT khách) vẫn do server kiểm tra.
 */
const StaffBookingModal = ({ onClose, onDone }) => {
  const toast = useToast()
  const [customer, setCustomer] = useState(null)
  const [pets, setPets] = useState([])
  const [services, setServices] = useState([])
  const [petId, setPetId] = useState('')
  const [serviceIds, setServiceIds] = useState([])
  const [date, setDate] = useState(todayStr())
  const [slot, setSlot] = useState(null)
  const [employeeId, setEmployeeId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    axiosClient.get('/services').then((res) => setServices(res.data.data.services.filter((s) => s.is_active))).catch(() => {})
  }, [])

  useEffect(() => {
    setPets([]); setPetId('')
    if (!customer) return
    axiosClient.get('/pets', { params: { customer_id: customer.id, status: 'active', limit: 100 } })
      .then((res) => setPets(res.data.data.pets))
      .catch((err) => setError(errorMessage(err, 'Không tải được thú cưng của khách.')))
  }, [customer])

  const chosen = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds])

  const toggleService = (id) => {
    setServiceIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
    setSlot(null); setEmployeeId('')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!customer) { setError('Vui lòng chọn khách hàng.'); return }
    if (!petId) { setError('Vui lòng chọn thú cưng.'); return }
    if (serviceIds.length === 0) { setError('Vui lòng chọn ít nhất một dịch vụ.'); return }
    if (!slot) { setError('Vui lòng chọn khung giờ.'); return }
    setSaving(true)
    setError('')
    try {
      await axiosClient.post('/appointments', {
        customerId: customer.id,
        petId: Number(petId),
        serviceIds,
        appointmentDate: date,
        startTime: slot.startTime,
        employeeId: employeeId ? Number(employeeId) : undefined,
        customerNotes: notes.trim() || undefined,
      })
      toast.success('Đã đặt lịch cho khách.')
      onDone()
    } catch (err) {
      const fields = mapFieldErrors(err)
      setError(fields ? Object.values(fields)[0] : errorMessage(err, 'Không thể đặt lịch.'))
      if (err?.response?.status === 409) { setSlot(null); setEmployeeId(''); setRefreshKey((k) => k + 1) }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Đặt lịch hộ khách" onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Khách hàng</p>
          <CustomerPicker value={customer} onChange={(c) => { setCustomer(c); setError('') }} />
        </div>

        <div>
          <label htmlFor="sb-pet" className="block text-sm font-medium text-gray-700 mb-1">Thú cưng</label>
          <select id="sb-pet" value={petId} onChange={(e) => setPetId(e.target.value)} disabled={!customer} className={inputClass}>
            <option value="">{customer ? (pets.length ? '-- Chọn thú cưng --' : 'Khách chưa có thú cưng') : 'Chọn khách trước'}</option>
            {pets.map((p) => <option key={p.id} value={p.id}>{p.name} ({SPECIES_LABEL[p.species] || 'Khác'})</option>)}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">Dịch vụ</legend>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {services.map((s) => (
              <li key={s.id}>
                <label className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer ${serviceIds.includes(s.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                  <input type="checkbox" checked={serviceIds.includes(s.id)} onChange={() => toggleService(s.id)} className="accent-blue-600" />
                  <span className="flex-1 min-w-0 truncate">{s.name}</span>
                  <span className="text-xs text-gray-500 shrink-0">{s.duration_minutes}′ · {formatVND(s.price)}</span>
                </label>
              </li>
            ))}
          </ul>
          {chosen.length > 0 && <p className="mt-2 text-xs text-gray-500">Tổng {sumDuration(chosen)} phút · {formatVND(sumPrice(chosen))}</p>}
        </fieldset>

        <div>
          <label htmlFor="sb-date" className="block text-sm font-medium text-gray-700 mb-1">Ngày</label>
          <input id="sb-date" type="date" value={date} min={todayStr()} max={addDays(todayStr(), 60)}
            onChange={(e) => { setDate(e.target.value || todayStr()); setSlot(null); setEmployeeId('') }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Giờ</p>
          <SlotPicker date={date} serviceIds={serviceIds} value={slot?.startTime} accent="blue" refreshKey={refreshKey}
            onChange={(s) => { setSlot(s); if (employeeId && !s.availableEmployees.some((e) => String(e.id) === String(employeeId))) setEmployeeId('') }} />
        </div>

        {slot && (
          <div>
            <label htmlFor="sb-emp" className="block text-sm font-medium text-gray-700 mb-1">Nhân viên</label>
            <select id="sb-emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass}>
              <option value="">Tự động sắp xếp (cân bằng tải)</option>
              {slot.availableEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="sb-notes" className="block text-sm font-medium text-gray-700 mb-1">Ghi chú của khách</label>
          <textarea id="sb-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700" role="alert">{error}</div>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Đóng</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Đang đặt...' : 'Đặt lịch'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default StaffBookingModal
