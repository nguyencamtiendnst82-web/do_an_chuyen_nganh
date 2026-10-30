import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Feedback'
import PetAvatar from '../../components/PetAvatar'
import SlotPicker from '../../components/SlotPicker'
import { CardSkeletonGrid } from '../../components/Skeleton'
import { formatVND, errorMessage, mapFieldErrors, SPECIES_LABEL } from '../../utils/format'
import { todayStr, addDays, formatDateLong, sumDuration, sumPrice } from '../../utils/appointment'

const STEPS = ['Thú cưng', 'Dịch vụ', 'Ngày & giờ', 'Xác nhận']

/**
 * BookingPage: khách đặt lịch theo 4 bước.
 * 1) chọn thú cưng  2) chọn dịch vụ (nhiều dịch vụ)  3) chọn ngày, giờ, nhân viên  4) xác nhận
 */
const BookingPage = () => {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [pets, setPets] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [petId, setPetId] = useState(null)
  const [serviceIds, setServiceIds] = useState([])
  const [date, setDate] = useState(todayStr())
  const [slot, setSlot] = useState(null)
  const [employeeId, setEmployeeId] = useState(null) // null = hệ thống tự chọn
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const hasPhone = Boolean(user?.phone && user.phone.trim())

  useEffect(() => {
    let cancelled = false
    Promise.all([
      axiosClient.get('/pets', { params: { status: 'active', limit: 100 } }),
      axiosClient.get('/services'),
    ])
      .then(([p, s]) => {
        if (cancelled) return
        setPets(p.data.data.pets)
        setServices(s.data.data.services.filter((x) => x.is_active))
      })
      .catch((err) => { if (!cancelled) setLoadError(errorMessage(err, 'Không tải được dữ liệu đặt lịch.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const pet = pets.find((p) => p.id === petId)
  const chosen = useMemo(() => services.filter((s) => serviceIds.includes(s.id)), [services, serviceIds])
  const totalMinutes = sumDuration(chosen)
  const totalPrice = sumPrice(chosen)

  const toggleService = (id) => {
    setServiceIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))
    setSlot(null) // đổi dịch vụ → thời lượng đổi → phải chọn lại giờ
    setEmployeeId(null)
  }

  const pickSlot = (s) => {
    setSlot(s)
    if (employeeId && !s.availableEmployees.some((e) => e.id === employeeId)) setEmployeeId(null)
  }

  const canNext = (step === 1 && petId) || (step === 2 && serviceIds.length > 0) || (step === 3 && slot)

  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await axiosClient.post('/appointments', {
        petId,
        serviceIds,
        appointmentDate: date,
        startTime: slot.startTime,
        employeeId: employeeId || undefined,
        customerNotes: notes.trim() || undefined,
      })
      toast.success('Đặt lịch thành công! Spa sẽ xác nhận với bạn sớm.')
      navigate('/appointments')
    } catch (err) {
      const fields = mapFieldErrors(err)
      const message = fields ? Object.values(fields)[0] : errorMessage(err, 'Không thể đặt lịch. Vui lòng thử lại.')
      setSubmitError(message)
      if (err?.response?.status === 409) {
        // Khung giờ vừa bị người khác đặt: tải lại giờ trống và quay về bước chọn giờ
        setSlot(null)
        setEmployeeId(null)
        setRefreshKey((k) => k + 1)
        setStep(3)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6"><CardSkeletonGrid count={2} /></div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Đặt lịch hẹn</h1>
        <p className="text-sm text-gray-500 mt-1">Chọn bé cưng, dịch vụ và khung giờ phù hợp. Có thể đặt trước tối đa 60 ngày.</p>
      </div>

      {/* Thanh các bước */}
      <ol className="flex items-center gap-2" aria-label="Các bước đặt lịch">
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = step > n
          const current = step === n
          return (
            <li key={label} className="flex-1 flex items-center gap-2 min-w-0" aria-current={current ? 'step' : undefined}>
              <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-pink-600 text-white' : current ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-500' : 'bg-gray-200 text-gray-500'}`}>
                {done ? '✓' : n}
              </span>
              <span className={`hidden sm:block text-xs truncate ${current ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
              {n < STEPS.length && <span className="flex-1 h-px bg-gray-200" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>

      {!hasPhone && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800" role="alert">
          Bạn cần cập nhật <strong>số điện thoại</strong> trước khi đặt lịch để spa liên hệ khi cần.{' '}
          <Link to="/profile" className="font-medium underline">Cập nhật hồ sơ</Link>
        </div>
      )}
      {loadError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{loadError}</div>}

      {/* Bước 1: chọn thú cưng */}
      {step === 1 && (
        pets.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
            <p className="text-sm text-gray-600">Bạn chưa có hồ sơ thú cưng nào.</p>
            <Link to="/pets" className="inline-block mt-3 px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700">Thêm thú cưng</Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Chọn thú cưng">
            {pets.map((p) => (
              <li key={p.id}>
                <button type="button" role="radio" aria-checked={petId === p.id} onClick={() => setPetId(p.id)}
                  className={`w-full flex items-center gap-3 text-left bg-white rounded-2xl border p-4 transition-colors ${petId === p.id ? 'border-pink-500 ring-2 ring-pink-200' : 'border-gray-200 hover:border-pink-300'}`}>
                  <PetAvatar pet={p} />
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-900 truncate">{p.name}</span>
                    <span className="block text-xs text-gray-500">{SPECIES_LABEL[p.species] || ''}{p.breed ? ` · ${p.breed}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Bước 2: chọn dịch vụ */}
      {step === 2 && (
        <div className="space-y-3">
          <ul className="space-y-3">
            {services.map((s) => {
              const on = serviceIds.includes(s.id)
              return (
                <li key={s.id}>
                  <label className={`flex items-start gap-3 bg-white rounded-2xl border p-4 cursor-pointer transition-colors ${on ? 'border-pink-500 ring-2 ring-pink-200' : 'border-gray-200 hover:border-pink-300'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleService(s.id)} className="mt-1 w-4 h-4 accent-pink-600" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-gray-900">{s.name}</span>
                      {s.description && <span className="block text-sm text-gray-500 mt-0.5">{s.description}</span>}
                      <span className="block text-xs text-gray-400 mt-1">⏱ {s.duration_minutes} phút</span>
                    </span>
                    <span className="font-bold text-pink-600 shrink-0">{formatVND(s.price)}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="bg-pink-50 rounded-xl px-4 py-3 text-sm flex justify-between">
            <span className="text-gray-700">Đã chọn {chosen.length} dịch vụ · {totalMinutes} phút</span>
            <strong className="text-pink-700">{formatVND(totalPrice)}</strong>
          </div>
        </div>
      )}

      {/* Bước 3: ngày, giờ, nhân viên */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <label htmlFor="bk-date" className="block text-sm font-medium text-gray-700 mb-1">Ngày hẹn</label>
            <input id="bk-date" type="date" value={date} min={todayStr()} max={addDays(todayStr(), 60)}
              onChange={(e) => { setDate(e.target.value || todayStr()); setSlot(null); setEmployeeId(null) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Khung giờ còn trống <span className="text-gray-400 font-normal">(tổng {totalMinutes} phút)</span></p>
            <SlotPicker date={date} serviceIds={serviceIds} value={slot?.startTime} onChange={pickSlot} refreshKey={refreshKey} />
          </div>
          {slot && (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Nhân viên phục vụ</legend>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="emp" checked={employeeId === null} onChange={() => setEmployeeId(null)} className="accent-pink-600" />
                  Để spa tự sắp xếp <span className="text-gray-400">(khuyên dùng)</span>
                </label>
                {slot.availableEmployees.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="emp" checked={employeeId === e.id} onChange={() => setEmployeeId(e.id)} className="accent-pink-600" />
                    {e.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {/* Bước 4: xác nhận */}
      {step === 4 && pet && slot && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <PetAvatar pet={pet} />
              <div>
                <p className="font-semibold text-gray-900">{pet.name}</p>
                <p className="text-xs text-gray-500">{SPECIES_LABEL[pet.species] || ''}</p>
              </div>
            </div>
            <dl className="text-sm divide-y divide-gray-100 border-t border-gray-100">
              <div className="flex justify-between py-2"><dt className="text-gray-500">Ngày</dt><dd>{formatDateLong(date)}</dd></div>
              <div className="flex justify-between py-2"><dt className="text-gray-500">Giờ</dt><dd>{slot.startTime} – {slot.endTime}</dd></div>
              <div className="flex justify-between py-2">
                <dt className="text-gray-500">Nhân viên</dt>
                <dd>{employeeId ? slot.availableEmployees.find((e) => e.id === employeeId)?.name : 'Spa tự sắp xếp'}</dd>
              </div>
            </dl>
            <ul className="space-y-1 text-sm border-t border-gray-100 pt-3">
              {chosen.map((s) => (
                <li key={s.id} className="flex justify-between"><span>{s.name}</span><span>{formatVND(s.price)}</span></li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-gray-100 pt-3 font-semibold">
              <span>Tạm tính</span><span className="text-pink-600">{formatVND(totalPrice)}</span>
            </div>
          </div>
          <div>
            <label htmlFor="bk-notes" className="block text-sm font-medium text-gray-700 mb-1">Ghi chú cho spa (không bắt buộc)</label>
            <textarea id="bk-notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Ví dụ: Bé hơi nhát nước, dễ bị dị ứng..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500" />
          </div>
          <p className="text-xs text-gray-500">Bạn có thể hủy hoặc đổi lịch miễn phí trước giờ hẹn tối thiểu 2 giờ.</p>
        </div>
      )}

      {submitError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{submitError}</div>}

      {/* Điều hướng */}
      <div className="flex justify-between gap-3 pt-2">
        <button type="button" onClick={() => { setSubmitError(''); setStep((s) => s - 1) }} disabled={step === 1 || submitting}
          className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-40">Quay lại</button>
        {step < 4 ? (
          <button type="button" onClick={() => { setSubmitError(''); setStep((s) => s + 1) }} disabled={!canNext}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50">Tiếp tục</button>
        ) : (
          <button type="button" onClick={submit} disabled={submitting || !hasPhone}
            className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-50">
            {submitting ? 'Đang đặt lịch...' : 'Đặt lịch'}
          </button>
        )}
      </div>
    </div>
  )
}

export default BookingPage
