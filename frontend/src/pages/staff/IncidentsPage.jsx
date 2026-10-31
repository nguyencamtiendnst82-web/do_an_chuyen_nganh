import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Feedback'
import Modal from '../../components/Modal'
import PetAvatar from '../../components/PetAvatar'
import { ListSkeleton } from '../../components/Skeleton'
import { errorMessage, mapFieldErrors } from '../../utils/format'

const TYPE_LABEL = {
  injury: 'Chấn thương / trầy xước',
  allergic_reaction: 'Dị ứng / phản ứng',
  behavioral_aggression: 'Thú cưng hung dữ / cắn',
  service_delay: 'Trễ giờ dịch vụ',
  equipment_damage: 'Hỏng dụng cụ',
  other: 'Khác',
}
const SEVERITY_LABEL = { low: 'Thấp', medium: 'Trung bình', high: 'Cao', critical: 'Nghiêm trọng' }
const SEVERITY_STYLE = {
  low: 'bg-gray-100 text-gray-600 border-gray-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-orange-50 text-orange-700 border-orange-300',
  critical: 'bg-red-50 text-red-700 border-red-300',
}
const STATUS_LABEL = { open: 'Mới', investigating: 'Đang xử lý', resolved: 'Đã xử lý' }
const STATUS_STYLE = {
  open: 'bg-red-50 text-red-700 border-red-200',
  investigating: 'bg-blue-50 text-blue-700 border-blue-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}

const fieldClass = 'w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
const selectClass = 'px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'

const Chip = ({ style, children }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>{children}</span>
)

const formatDateTime = (s) => {
  if (!s) return ''
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** Form ghi nhận sự cố mới: chọn thú cưng bằng ô tìm kiếm (tên bé, tên hoặc SĐT chủ) */
const IncidentFormModal = ({ onClose, onDone }) => {
  const toast = useToast()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState([])
  const [pet, setPet] = useState(null)
  const [form, setForm] = useState({ title: '', incidentType: 'injury', severity: 'low', description: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (pet || keyword.trim().length < 2) { setResults([]); return undefined }
    const timer = setTimeout(() => {
      axiosClient.get('/pets', { params: { search: keyword.trim(), limit: 6, status: 'active' } })
        .then((res) => setResults(res.data.data.pets))
        .catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword, pet])

  const set = (key) => (e) => { setForm((f) => ({ ...f, [key]: e.target.value })); setErrors((x) => ({ ...x, [key]: undefined })) }

  const submit = async (e) => {
    e.preventDefault()
    if (!pet) { setErrors({ pet_id: 'Vui lòng chọn thú cưng.' }); return }
    setSaving(true)
    setError('')
    setErrors({})
    try {
      await axiosClient.post('/incidents', { petId: pet.id, ...form })
      toast.success('Đã ghi nhận sự cố.')
      onDone()
    } catch (err) {
      const fields = mapFieldErrors(err)
      if (fields) setErrors({ pet_id: fields.pet_id, title: fields.title, incidentType: fields.incident_type, severity: fields.severity, description: fields.description })
      else setError(errorMessage(err, 'Không thể ghi nhận sự cố.'))
    } finally {
      setSaving(false)
    }
  }

  const fieldErr = (key) => errors[key] && <p className="mt-1 text-xs text-red-600" role="alert">{errors[key]}</p>
  const border = (key) => (errors[key] ? 'border-red-400 bg-red-50' : 'border-gray-300')

  return (
    <Modal title="Ghi nhận sự cố" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="inc-pet" className="block text-sm font-medium text-gray-700 mb-1">Thú cưng gặp sự cố</label>
          {pet ? (
            <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
              <PetAvatar pet={pet} size="w-9 h-9" text="text-lg" />
              <span className="flex-1 text-sm font-medium text-gray-900">{pet.name}{pet.owner_name ? <span className="text-gray-400 font-normal"> · {pet.owner_name}</span> : null}</span>
              <button type="button" onClick={() => { setPet(null); setKeyword('') }} className="text-sm text-blue-600 hover:underline">Đổi</button>
            </div>
          ) : (
            <>
              <input id="inc-pet" value={keyword} onChange={(e) => setKeyword(e.target.value)} autoComplete="off"
                placeholder="Gõ tên bé hoặc SĐT chủ (ít nhất 2 ký tự)" className={`${fieldClass} ${border('pet_id')}`} />
              {results.length > 0 && (
                <ul className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => setPet(p)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50">
                        <PetAvatar pet={p} size="w-8 h-8" text="text-base" />
                        <span className="text-sm text-gray-900">{p.name}{p.owner_name ? <span className="text-gray-400"> · {p.owner_name}</span> : null}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {fieldErr('pet_id')}
        </div>

        <div>
          <label htmlFor="inc-title" className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề</label>
          <input id="inc-title" value={form.title} maxLength={200} onChange={set('title')} placeholder="Ví dụ: Bé bị trầy da khi tắm" className={`${fieldClass} ${border('title')}`} />
          {fieldErr('title')}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="inc-type" className="block text-sm font-medium text-gray-700 mb-1">Loại sự cố</label>
            <select id="inc-type" value={form.incidentType} onChange={set('incidentType')} className={`${fieldClass} ${border('incidentType')}`}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {fieldErr('incidentType')}
          </div>
          <div>
            <label htmlFor="inc-sev" className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
            <select id="inc-sev" value={form.severity} onChange={set('severity')} className={`${fieldClass} ${border('severity')}`}>
              {Object.entries(SEVERITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {fieldErr('severity')}
          </div>
        </div>

        <div>
          <label htmlFor="inc-desc" className="block text-sm font-medium text-gray-700 mb-1">Diễn biến</label>
          <textarea id="inc-desc" rows={4} maxLength={3000} value={form.description} onChange={set('description')}
            placeholder="Mô tả chuyện gì đã xảy ra, bé phản ứng thế nào, đã xử lý tạm ra sao..." className={`${fieldClass} ${border('description')}`} />
          {fieldErr('description')}
        </div>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Đóng</button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60">
            {saving ? 'Đang lưu...' : 'Ghi nhận'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Chi tiết sự cố. Admin được đổi trạng thái, mức độ và nhập biện pháp khắc phục. */
const IncidentDetailModal = ({ incident, canEdit, onClose, onDone }) => {
  const toast = useToast()
  const [status, setStatus] = useState(incident.status)
  const [severity, setSeverity] = useState(incident.severity)
  const [resolution, setResolution] = useState(incident.resolution || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await axiosClient.patch(`/incidents/${incident.id}`, { status, severity, resolution })
      toast.success('Đã cập nhật sự cố.')
      onDone()
    } catch (err) {
      const fields = mapFieldErrors(err)
      setError(fields?.resolution || errorMessage(err, 'Không thể cập nhật sự cố.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={incident.title} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Chip style={SEVERITY_STYLE[incident.severity]}>{SEVERITY_LABEL[incident.severity]}</Chip>
          <Chip style={STATUS_STYLE[incident.status]}>{STATUS_LABEL[incident.status]}</Chip>
          <span className="text-gray-500">{TYPE_LABEL[incident.incident_type]}</span>
        </div>
        <dl className="divide-y divide-gray-100 border-y border-gray-100">
          <div className="flex justify-between gap-4 py-2"><dt className="text-gray-500">Thú cưng</dt><dd className="text-gray-900">{incident.pet_name}</dd></div>
          {incident.appointment_code && <div className="flex justify-between gap-4 py-2"><dt className="text-gray-500">Lịch hẹn</dt><dd className="font-mono text-gray-900">{incident.appointment_code}</dd></div>}
          <div className="flex justify-between gap-4 py-2"><dt className="text-gray-500">Người báo cáo</dt><dd className="text-gray-900">{incident.reporter_name}</dd></div>
          <div className="flex justify-between gap-4 py-2"><dt className="text-gray-500">Thời điểm</dt><dd className="text-gray-900">{formatDateTime(incident.created_at)}</dd></div>
          {incident.resolved_at && <div className="flex justify-between gap-4 py-2"><dt className="text-gray-500">Xử lý xong</dt><dd className="text-gray-900">{formatDateTime(incident.resolved_at)}</dd></div>}
        </dl>
        <div>
          <p className="font-medium text-gray-700 mb-1">Diễn biến</p>
          <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{incident.description}</p>
        </div>

        {canEdit ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inc-status" className="block font-medium text-gray-700 mb-1">Trạng thái</label>
                <select id="inc-status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${fieldClass} border-gray-300`}>
                  {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="inc-sev2" className="block font-medium text-gray-700 mb-1">Mức độ</label>
                <select id="inc-sev2" value={severity} onChange={(e) => setSeverity(e.target.value)} className={`${fieldClass} border-gray-300`}>
                  {Object.entries(SEVERITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="inc-res" className="block font-medium text-gray-700 mb-1">Biện pháp khắc phục {status === 'resolved' && <span className="text-red-500">*</span>}</label>
              <textarea id="inc-res" rows={3} maxLength={3000} value={resolution} onChange={(e) => setResolution(e.target.value)} className={`${fieldClass} border-gray-300`} />
            </div>
            {error && <p className="text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Đóng</button>
              <button type="button" onClick={save} disabled={saving} className="px-4 py-2 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {incident.resolution && (
              <div>
                <p className="font-medium text-gray-700 mb-1">Biện pháp khắc phục</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">{incident.resolution}</p>
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100">Đóng</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/**
 * IncidentsPage: sự cố trong quá trình phục vụ.
 * Nhân viên: ghi nhận sự cố và xem các sự cố do mình báo. Admin: xem tất cả và xử lý.
 */
const IncidentsPage = () => {
  const { user } = useAuth()
  const isAdmin = user?.role_name === 'admin'
  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [status, setStatus] = useState('')
  const [severity, setSeverity] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.get('/incidents', {
        params: { status: status || undefined, severity: severity || undefined, page, limit: 10 },
      })
      setItems(res.data.data.incidents)
      setPagination(res.data.data.pagination)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách sự cố.'))
    } finally {
      setLoading(false)
    }
  }, [status, severity, page])

  useEffect(() => { load() }, [load])

  const afterChange = () => { setShowForm(false); setSelected(null); load() }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sự cố</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'Tất cả sự cố trong quá trình phục vụ.' : 'Các sự cố do bạn ghi nhận.'} Sự cố chưa xử lý và nghiêm trọng hiện lên trước.
          </p>
        </div>
        <button type="button" onClick={() => setShowForm(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">+ Ghi nhận sự cố</button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className={selectClass} aria-label="Lọc theo trạng thái">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1) }} className={selectClass} aria-label="Lọc theo mức độ">
          <option value="">Mọi mức độ</option>
          {Object.entries(SEVERITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">Chưa có sự cố nào.</div>
      ) : (
        <ul className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setSelected(i)} className="w-full text-left p-4 hover:bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">{i.title}</p>
                  <p className="text-xs text-gray-500">
                    {i.pet_name} · {TYPE_LABEL[i.incident_type]} · {i.reporter_name} · {formatDateTime(i.created_at)}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Chip style={SEVERITY_STYLE[i.severity]}>{SEVERITY_LABEL[i.severity]}</Chip>
                  <Chip style={STATUS_STYLE[i.status]}>{STATUS_LABEL[i.status]}</Chip>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pagination.total_pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">Trước</button>
          <span className="text-gray-600">Trang {pagination.page} / {pagination.total_pages}</span>
          <button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-300 disabled:opacity-40">Sau</button>
        </div>
      )}

      {showForm && <IncidentFormModal onClose={() => setShowForm(false)} onDone={afterChange} />}
      {selected && <IncidentDetailModal incident={selected} canEdit={isAdmin} onClose={() => setSelected(null)} onDone={afterChange} />}
    </div>
  )
}

export default IncidentsPage
