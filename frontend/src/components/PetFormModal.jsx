import { useState } from 'react'
import axiosClient from '../api/axiosClient'
import Modal from './Modal'
import PhotoPicker from './PhotoPicker'
import CustomerPicker from './CustomerPicker'
import {
  SPECIES_LABEL, GENDER_LABEL, SPECIES_ICON, formatAge, errorMessage, mapFieldErrors,
  currentYearMonth, ageFromBirthMonth, uploadErrorMessage,
} from '../utils/format'

const emptyForm = {
  name: '', species: 'dog', gender: 'unknown', breed: '', birth_month: '', weight_kg: '', special_notes: '',
}

const fromPet = (pet) => ({
  name: pet.name || '',
  species: pet.species || 'dog',
  gender: pet.gender || 'unknown',
  breed: pet.breed || '',
  birth_month: pet.birth_month || '',
  weight_kg: pet.weight_kg ?? '',
  special_notes: pet.special_notes || '',
})

const MIN_YEAR_SPAN = 40

const minMonth = () => {
  const now = new Date()
  return `${now.getFullYear() - MIN_YEAR_SPAN}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const inputClass = (hasError) =>
  `w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-300'}`

/**
 * PetFormModal: thêm mới (pet = null) hoặc sửa hồ sơ thú cưng
 * - needsOwner: nhân viên / admin thêm thú hộ khách → phải chọn khách bằng ô tìm kiếm
 * - Tuổi không nhập tay: chọn THÁNG SINH, hệ thống tự tính tuổi theo ngày hôm nay
 * onSaved(pet, warning) được gọi sau khi lưu thành công (warning = lời nhắc nếu tải ảnh lỗi)
 */
const PetFormModal = ({ pet = null, needsOwner = false, onClose, onSaved }) => {
  const isEdit = Boolean(pet)
  const [form, setForm] = useState(pet ? fromPet(pet) : emptyForm)
  const [owner, setOwner] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoRemoved, setPhotoRemoved] = useState(false)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name] || errors._global) setErrors((prev) => ({ ...prev, [name]: '', _global: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Vui lòng nhập tên thú cưng.'
    if (needsOwner && !isEdit && !owner) errs.customer_id = 'Vui lòng chọn khách hàng là chủ của thú cưng.'
    if (form.birth_month !== '') {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(form.birth_month)) errs.birth_month = 'Tháng sinh không hợp lệ.'
      else if (form.birth_month > currentYearMonth()) errs.birth_month = 'Tháng sinh không được ở tương lai.'
      else if (form.birth_month < minMonth()) errs.birth_month = `Tháng sinh không hợp lệ (tối đa ${MIN_YEAR_SPAN} năm trước).`
    }
    if (form.weight_kg !== '') {
      const w = Number(form.weight_kg)
      if (Number.isNaN(w) || w < 0.1 || w > 150) errs.weight_kg = 'Cân nặng từ 0,1 đến 150 kg.'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const payload = {
      name: form.name.trim(),
      species: form.species,
      gender: form.gender,
      breed: form.breed.trim() || null,
      birth_month: form.birth_month === '' ? null : form.birth_month,
      weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
      special_notes: form.special_notes.trim() || null,
    }

    if (needsOwner && !isEdit) payload.customer_id = owner.id

    setLoading(true)
    try {
      const res = isEdit
        ? await axiosClient.put(`/pets/${pet.id}`, payload)
        : await axiosClient.post('/pets', payload)
      let saved = res.data.data.pet
      let warning = ''

      // Hồ sơ đã lưu xong; bước ảnh lỗi thì chỉ nhắc, không làm mất hồ sơ vừa lưu
      try {
        if (photoFile) {
          const fd = new FormData()
          fd.append('photo', photoFile)
          const up = await axiosClient.post(`/pets/${saved.id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          saved = up.data.data.pet
        } else if (photoRemoved && saved.avatar_url) {
          const del = await axiosClient.delete(`/pets/${saved.id}/photo`)
          saved = del.data.data.pet
        }
      } catch (photoErr) {
        warning = `Hồ sơ đã lưu nhưng chưa cập nhật được ảnh: ${uploadErrorMessage(photoErr, 'vui lòng thử lại.')}`
      }
      onSaved(saved, warning)
    } catch (err) {
      setErrors(mapFieldErrors(err) || { _global: errorMessage(err, 'Lưu thông tin thất bại. Vui lòng thử lại.') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title={isEdit ? `Sửa hồ sơ: ${pet.name}` : 'Thêm thú cưng'} onClose={loading ? () => {} : onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {errors._global && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
            {errors._global}
          </div>
        )}

        {needsOwner && !isEdit && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng (chủ nuôi) *</label>
            <CustomerPicker value={owner} error={errors.customer_id}
              onChange={(c) => { setOwner(c); setErrors((prev) => ({ ...prev, customer_id: '', _global: '' })) }} />
          </div>
        )}

        {needsOwner && isEdit && (
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            Chủ nuôi: <span className="font-medium">{pet.owner_name}</span> · {pet.owner_phone}
          </p>
        )}

        <PhotoPicker label="Ảnh thú cưng" currentUrl={pet?.avatar_url} file={photoFile} onFile={setPhotoFile}
          removed={photoRemoved} onRemove={setPhotoRemoved} fallback={SPECIES_ICON[form.species] || '🐾'} />

        <div>
          <label htmlFor="pet-name" className="block text-sm font-medium text-gray-700 mb-1">Tên thú cưng *</label>
          <input id="pet-name" name="name" value={form.name} onChange={handleChange} maxLength={100}
            className={inputClass(errors.name)} placeholder="VD: Bông Xù" />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pet-species" className="block text-sm font-medium text-gray-700 mb-1">Loài</label>
            <select id="pet-species" name="species" value={form.species} onChange={handleChange}
              className={`${inputClass(errors.species)} bg-white`}>
              {Object.entries(SPECIES_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {errors.species && <p className="mt-1 text-xs text-red-600">{errors.species}</p>}
          </div>
          <div>
            <label htmlFor="pet-gender" className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
            <select id="pet-gender" name="gender" value={form.gender} onChange={handleChange}
              className={`${inputClass(errors.gender)} bg-white`}>
              {Object.entries(GENDER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {errors.gender && <p className="mt-1 text-xs text-red-600">{errors.gender}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="pet-breed" className="block text-sm font-medium text-gray-700 mb-1">Giống</label>
          <input id="pet-breed" name="breed" value={form.breed} onChange={handleChange} maxLength={100}
            className={inputClass(errors.breed)} placeholder="VD: Poodle, Golden, Mèo Anh lông ngắn..." />
          {errors.breed && <p className="mt-1 text-xs text-red-600">{errors.breed}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pet-birth" className="block text-sm font-medium text-gray-700 mb-1">Tháng sinh</label>
            <input id="pet-birth" name="birth_month" type="month" min={minMonth()} max={currentYearMonth()}
              value={form.birth_month} onChange={handleChange} className={inputClass(errors.birth_month)} />
            {errors.birth_month ? (
              <p className="mt-1 text-xs text-red-600">{errors.birth_month}</p>
            ) : (
              <p className="mt-1 text-xs text-gray-400">
                {ageFromBirthMonth(form.birth_month) !== null
                  ? `Hiện khoảng ${formatAge(ageFromBirthMonth(form.birth_month))} tuổi (tự tính)`
                  : 'Chỉ cần chọn tháng và năm; tuổi được tự tính.'}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="pet-weight" className="block text-sm font-medium text-gray-700 mb-1">Cân nặng (kg)</label>
            <input id="pet-weight" name="weight_kg" type="number" inputMode="decimal" step="0.1" min={0.1} max={150}
              value={form.weight_kg} onChange={handleChange} className={inputClass(errors.weight_kg)} placeholder="VD: 4.5" />
            {errors.weight_kg && <p className="mt-1 text-xs text-red-600">{errors.weight_kg}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="pet-notes" className="block text-sm font-medium text-gray-700 mb-1">Lưu ý đặc biệt</label>
          <textarea id="pet-notes" name="special_notes" rows={3} value={form.special_notes} onChange={handleChange}
            maxLength={2000} className={`${inputClass(errors.special_notes)} resize-none`}
            placeholder="Dị ứng, tính khí, bệnh lý, thói quen... để nhân viên chăm sóc phù hợp" />
          {errors.special_notes && <p className="mt-1 text-xs text-red-600">{errors.special_notes}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-60">
            Hủy
          </button>
          <button type="submit" disabled={loading}
            className="bg-pink-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm thú cưng'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default PetFormModal
