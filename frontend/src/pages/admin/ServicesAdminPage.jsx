import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import Modal from '../../components/Modal'
import PhotoPicker from '../../components/PhotoPicker'
import { ListSkeleton } from '../../components/Skeleton'
import { useToast, useConfirm } from '../../components/Feedback'
import { formatVND, errorMessage, mapFieldErrors, uploadErrorMessage } from '../../utils/format'

const EMPTY_FORM = { name: '', description: '', price: '', duration_minutes: '60' }

const Thumb = ({ service }) =>
  service.image_url ? (
    <img src={service.image_url} alt={service.name} loading="lazy" className="w-12 h-12 rounded-lg object-cover bg-purple-50 shrink-0" />
  ) : (
    <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center text-xl shrink-0" aria-hidden="true">✂️</div>
  )

const StatusBadge = ({ active }) => (
  <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${active ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
    {active ? 'Đang bật' : 'Đang ẩn'}
  </span>
)

const inputClass = (hasError) =>
  `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`

/**
 * ServicesAdminPage: quản lý danh mục dịch vụ (admin)
 * - Thêm / sửa dịch vụ, bật / ẩn dịch vụ (không xóa cứng vì dịch vụ có thể đã nằm trong lịch hẹn, hóa đơn)
 */
const ServicesAdminPage = () => {
  const toast = useToast()
  const confirm = useConfirm()
  const [services, setServices] = useState([])
  const [filter, setFilter] = useState('all') // all | true | false
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  // Form thêm / sửa
  const [modal, setModal] = useState(null) // null | { service?: object }
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axiosClient.get('/services', {
        params: {
          is_active: filter === 'all' ? undefined : filter,
          search: search.trim() || undefined,
        },
      })
      setServices(res.data.data.services)
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách dịch vụ.'))
    } finally {
      setLoading(false)
    }
  }, [filter, search])

  useEffect(() => {
    const timer = setTimeout(load, 300)
    return () => clearTimeout(timer)
  }, [load])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setImageFile(null)
    setImageRemoved(false)
    setModal({})
  }

  const openEdit = (service) => {
    setForm({
      name: service.name,
      description: service.description || '',
      price: String(service.price),
      duration_minutes: String(service.duration_minutes),
    })
    setFormErrors({})
    setImageFile(null)
    setImageRemoved(false)
    setModal({ service })
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name] || formErrors._global) setFormErrors((prev) => ({ ...prev, [name]: '', _global: '' }))
  }

  const validate = () => {
    const errs = {}
    if (form.name.trim().length < 2) errs.name = 'Tên dịch vụ phải có ít nhất 2 ký tự.'
    const price = Number(form.price)
    if (form.price === '' || !Number.isInteger(price) || price < 0 || price > 100000000) {
      errs.price = 'Giá là số nguyên từ 0 đến 100.000.000 (VND).'
    }
    const minutes = Number(form.duration_minutes)
    if (form.duration_minutes === '' || !Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
      errs.duration_minutes = 'Thời lượng là số nguyên từ 5 đến 480 phút.'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs)
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      duration_minutes: Number(form.duration_minutes),
    }

    setSaving(true)
    try {
      let saved
      if (modal.service) {
        saved = (await axiosClient.put(`/services/${modal.service.id}`, payload)).data.data.service
      } else {
        saved = (await axiosClient.post('/services', payload)).data.data.service
      }
      toast.success(modal.service ? `Đã cập nhật dịch vụ "${payload.name}".` : `Đã thêm dịch vụ "${payload.name}".`)

      // Dịch vụ đã lưu xong; lỗi ảnh chỉ nhắc, không làm mất dữ liệu vừa lưu
      try {
        if (imageFile) {
          const fd = new FormData()
          fd.append('image', imageFile)
          await axiosClient.post(`/services/${saved.id}/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        } else if (imageRemoved && saved.image_url) {
          await axiosClient.delete(`/services/${saved.id}/image`)
        }
      } catch (imgErr) {
        toast.error(`Chưa cập nhật được ảnh: ${uploadErrorMessage(imgErr, 'vui lòng thử lại.')}`)
      }
      setModal(null)
      await load()
    } catch (err) {
      setFormErrors(mapFieldErrors(err) || { _global: errorMessage(err, 'Lưu dịch vụ thất bại.') })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (service) => {
    const next = !service.is_active
    if (!next) {
      const ok = await confirm({
        title: `Ẩn dịch vụ "${service.name}"?`,
        message: 'Khách hàng sẽ không thấy dịch vụ này khi đặt lịch. Lịch hẹn và hóa đơn cũ vẫn được giữ nguyên.',
        confirmText: 'Ẩn dịch vụ',
        danger: true,
      })
      if (!ok) return
    }

    setBusyId(service.id)
    try {
      await axiosClient.patch(`/services/${service.id}/active`, { is_active: next })
      toast.success(next ? `Đã bật dịch vụ "${service.name}".` : `Đã ẩn dịch vụ "${service.name}".`)
      await load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể đổi trạng thái dịch vụ.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý dịch vụ</h1>
          <p className="text-sm text-gray-500 mt-1">Giá và thời lượng ở đây là giá niêm yết; hệ thống sẽ tự tính tiền khi đặt lịch.</p>
        </div>
        <button type="button" onClick={openCreate}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
          + Thêm dịch vụ
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc mô tả..." aria-label="Tìm dịch vụ"
          className="w-full sm:w-72 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Lọc theo trạng thái"
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500">
          <option value="all">Tất cả</option>
          <option value="true">Đang bật</option>
          <option value="false">Đang ẩn</option>
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : services.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">Không có dịch vụ nào.</div>
      ) : (
        <>
          {/* Máy tính: bảng */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Dịch vụ</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Giá</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Thời lượng</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {services.map((s) => (
                  <tr key={s.id} className={s.is_active ? '' : 'bg-gray-50 text-gray-500'}>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-3">
                        <Thumb service={s} />
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{s.name}</p>
                          {s.description && <p className="text-xs text-gray-500 line-clamp-2">{s.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{formatVND(s.price)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{s.duration_minutes} phút</td>
                    <td className="px-4 py-3"><StatusBadge active={s.is_active} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button type="button" onClick={() => openEdit(s)} className="text-purple-700 hover:underline mr-3">Sửa</button>
                      <button type="button" onClick={() => toggleActive(s)} disabled={busyId === s.id}
                        className={`hover:underline disabled:opacity-60 ${s.is_active ? 'text-red-600' : 'text-green-700'}`}>
                        {busyId === s.id ? '...' : s.is_active ? 'Ẩn' : 'Bật lại'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Điện thoại: thẻ */}
          <ul className="md:hidden space-y-3">
            {services.map((s) => (
              <li key={s.id} className={`bg-white rounded-2xl border border-gray-200 p-4 ${s.is_active ? '' : 'opacity-70'}`}>
                <div className="flex items-start gap-3">
                  <Thumb service={s} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="text-sm text-purple-700 font-medium">{formatVND(s.price)} · {s.duration_minutes} phút</p>
                  </div>
                  <StatusBadge active={s.is_active} />
                </div>
                {s.description && <p className="mt-2 text-xs text-gray-600 line-clamp-3">{s.description}</p>}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={() => openEdit(s)} className="text-sm text-purple-700 border border-purple-200 rounded-lg px-3 py-1.5">Sửa</button>
                  <button type="button" onClick={() => toggleActive(s)} disabled={busyId === s.id}
                    className={`text-sm rounded-lg px-3 py-1.5 disabled:opacity-60 ${s.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>
                    {busyId === s.id ? '...' : s.is_active ? 'Ẩn' : 'Bật lại'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {modal && (
        <Modal title={modal.service ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} onClose={saving ? () => {} : () => setModal(null)}>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {formErrors._global && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{formErrors._global}</div>
            )}

            <PhotoPicker label="Ảnh dịch vụ" shape="square" currentUrl={modal.service?.image_url} file={imageFile}
              onFile={setImageFile} removed={imageRemoved} onRemove={setImageRemoved} fallback="✂️" />

            <div>
              <label htmlFor="sv-name" className="block text-sm font-medium text-gray-700 mb-1">Tên dịch vụ *</label>
              <input id="sv-name" name="name" value={form.name} onChange={handleChange} maxLength={150} className={inputClass(formErrors.name)} />
              {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="sv-desc" className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
              <textarea id="sv-desc" name="description" rows={3} value={form.description} onChange={handleChange} maxLength={2000}
                className={`${inputClass(formErrors.description)} resize-none`} />
              {formErrors.description && <p className="mt-1 text-xs text-red-600">{formErrors.description}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sv-price" className="block text-sm font-medium text-gray-700 mb-1">Giá (VND) *</label>
                <input id="sv-price" name="price" type="number" inputMode="numeric" min={0} step={1000}
                  value={form.price} onChange={handleChange} className={inputClass(formErrors.price)} placeholder="VD: 200000" />
                {formErrors.price && <p className="mt-1 text-xs text-red-600">{formErrors.price}</p>}
              </div>
              <div>
                <label htmlFor="sv-duration" className="block text-sm font-medium text-gray-700 mb-1">Thời lượng (phút) *</label>
                <input id="sv-duration" name="duration_minutes" type="number" inputMode="numeric" min={5} max={480} step={5}
                  value={form.duration_minutes} onChange={handleChange} className={inputClass(formErrors.duration_minutes)} />
                {formErrors.duration_minutes && <p className="mt-1 text-xs text-red-600">{formErrors.duration_minutes}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">Hủy</button>
              <button type="submit" disabled={saving}
                className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {saving ? 'Đang lưu...' : modal.service ? 'Lưu thay đổi' : 'Thêm dịch vụ'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default ServicesAdminPage
