import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../../api/axiosClient'
import Modal from '../../components/Modal'
import { ListSkeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Feedback'
import { formatVND, errorMessage, mapFieldErrors } from '../../utils/format'
import { formatDate } from '../../utils/appointment'

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500'
const EMPTY = { name: '', discount_type: 'percent', discount_value: '', service_id: '', min_invoice: '', start_date: '', end_date: '' }

const valueText = (p) => (p.discount_type === 'percent' ? `${Number(p.discount_value)}%` : formatVND(p.discount_value))
const ymd = (v) => String(v || '').slice(0, 10)

const statusOf = (p, today) => {
  if (!p.is_active) return { label: 'Đã tắt', style: 'bg-gray-100 text-gray-600 border-gray-200' }
  if (ymd(p.end_date) < today) return { label: 'Hết hạn', style: 'bg-gray-100 text-gray-600 border-gray-200' }
  if (ymd(p.start_date) > today) return { label: 'Sắp diễn ra', style: 'bg-pink-50 text-pink-700 border-pink-200' }
  return { label: 'Đang áp dụng', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

/** Admin: chương trình khuyến mãi tự động áp dụng khi lập hóa đơn */
const PromotionsPage = () => {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { promotion? }
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const today = new Date().toLocaleDateString('en-CA')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [p, s] = await Promise.all([axiosClient.get('/promotions'), axiosClient.get('/services', { params: { limit: 100 } })])
      setItems(p.data.data.promotions)
      setServices(s.data.data.services || [])
    } catch (err) {
      setError(errorMessage(err, 'Không tải được danh sách khuyến mãi.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setForm(EMPTY); setErrors({}); setModal({}) }
  const openEdit = (p) => {
    setForm({
      name: p.name, discount_type: p.discount_type, discount_value: String(Number(p.discount_value)),
      service_id: p.service_id ? String(p.service_id) : '', min_invoice: Number(p.min_invoice) ? String(Number(p.min_invoice)) : '',
      start_date: ymd(p.start_date), end_date: ymd(p.end_date),
    })
    setErrors({})
    setModal({ promotion: p })
  }
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    const payload = {
      name: form.name.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      service_id: form.service_id ? Number(form.service_id) : null,
      min_invoice: Number(form.min_invoice) || 0,
      start_date: form.start_date,
      end_date: form.end_date,
    }
    try {
      if (modal.promotion) await axiosClient.put(`/promotions/${modal.promotion.id}`, payload)
      else await axiosClient.post('/promotions', payload)
      toast.success(modal.promotion ? 'Đã cập nhật khuyến mãi.' : 'Đã tạo khuyến mãi.')
      setModal(null)
      load()
    } catch (err) {
      const fields = mapFieldErrors(err) || {}
      if (Object.keys(fields).length) setErrors(fields)
      else setErrors({ _form: errorMessage(err, 'Không lưu được khuyến mãi.') })
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (p) => {
    try {
      await axiosClient.patch(`/promotions/${p.id}/active`, { is_active: !p.is_active })
      toast.success(p.is_active ? 'Đã tắt khuyến mãi.' : 'Đã bật khuyến mãi.')
      load()
    } catch (err) {
      toast.error(errorMessage(err, 'Không đổi được trạng thái.'))
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khuyến mãi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Hệ thống tự áp dụng chương trình giảm nhiều nhất còn hiệu lực khi nhân viên lập hóa đơn (không cộng dồn).</p>
        </div>
        <button type="button" onClick={openCreate} className="px-4 py-2 rounded-lg bg-pink-600 text-white text-sm font-medium hover:bg-pink-700">+ Thêm khuyến mãi</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

      {loading ? <ListSkeleton rows={4} /> : items.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-sm text-gray-500">Chưa có chương trình khuyến mãi nào.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Chương trình</th>
                <th className="text-left font-medium px-4 py-2.5">Mức giảm</th>
                <th className="text-left font-medium px-4 py-2.5">Áp dụng cho</th>
                <th className="text-left font-medium px-4 py-2.5">Thời gian</th>
                <th className="text-left font-medium px-4 py-2.5">Trạng thái</th>
                <th className="text-right font-medium px-4 py-2.5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => {
                const st = statusOf(p, today)
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                    <td className="px-4 py-3 text-gray-700">{valueText(p)}{Number(p.min_invoice) > 0 && <span className="block text-xs text-gray-500">HĐ từ {formatVND(p.min_invoice)}</span>}</td>
                    <td className="px-4 py-3 text-gray-700">{p.service_name || 'Mọi dịch vụ'}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(ymd(p.start_date))} – {formatDate(ymd(p.end_date))}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.style}`}>{st.label}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => openEdit(p)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">Sửa</button>
                        <button type="button" onClick={() => toggle(p)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-200 hover:bg-gray-50">{p.is_active ? 'Tắt' : 'Bật'}</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.promotion ? 'Sửa khuyến mãi' : 'Thêm khuyến mãi'} onClose={() => setModal(null)}>
          <form onSubmit={submit} className="space-y-4">
            {errors._form && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700" role="alert">{errors._form}</div>}
            <div>
              <label htmlFor="pr-name" className="block text-sm font-medium text-gray-700 mb-1">Tên chương trình</label>
              <input id="pr-name" name="name" value={form.name} onChange={change} maxLength={150} required className={inputClass} placeholder="VD: Khuyến mãi 20/11" />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pr-type" className="block text-sm font-medium text-gray-700 mb-1">Loại giảm</label>
                <select id="pr-type" name="discount_type" value={form.discount_type} onChange={change} className={inputClass}>
                  <option value="percent">Theo %</option>
                  <option value="amount">Số tiền cố định</option>
                </select>
              </div>
              <div>
                <label htmlFor="pr-value" className="block text-sm font-medium text-gray-700 mb-1">{form.discount_type === 'percent' ? 'Giảm (%)' : 'Giảm (đ)'}</label>
                <input id="pr-value" name="discount_value" type="number" min="0" step={form.discount_type === 'percent' ? '1' : '1000'} value={form.discount_value} onChange={change} required className={inputClass} />
                {errors.discount_value && <p className="mt-1 text-xs text-red-600">{errors.discount_value}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pr-service" className="block text-sm font-medium text-gray-700 mb-1">Áp dụng cho</label>
                <select id="pr-service" name="service_id" value={form.service_id} onChange={change} className={inputClass}>
                  <option value="">Mọi dịch vụ</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pr-min" className="block text-sm font-medium text-gray-700 mb-1">Hóa đơn tối thiểu (đ)</label>
                <input id="pr-min" name="min_invoice" type="number" min="0" step="1000" value={form.min_invoice} onChange={change} className={inputClass} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pr-start" className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                <input id="pr-start" name="start_date" type="date" value={form.start_date} onChange={change} required className={inputClass} />
                {errors.start_date && <p className="mt-1 text-xs text-red-600">{errors.start_date}</p>}
              </div>
              <div>
                <label htmlFor="pr-end" className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                <input id="pr-end" name="end_date" type="date" value={form.end_date} onChange={change} required className={inputClass} />
                {errors.end_date && <p className="mt-1 text-xs text-red-600">{errors.end_date}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">Hủy</button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 disabled:opacity-60">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export default PromotionsPage
