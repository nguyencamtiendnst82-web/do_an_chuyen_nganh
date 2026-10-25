import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axiosClient from '../api/axiosClient'
import PasswordField from './PasswordField'
import PasswordStrength from './PasswordStrength'
import { evaluatePassword, isTooLongForBcrypt } from '../utils/passwordStrength'

const EMPTY_FORM = { old_password: '', new_password: '', confirm_new_password: '' }

/**
 * ChangePasswordCard: biểu mẫu đổi mật khẩu
 * - Hiện/ẩn mật khẩu, cảnh báo Caps Lock
 * - Thanh đo độ mạnh + danh sách yêu cầu theo thời gian thực
 * - Kiểm tra khớp mật khẩu xác nhận, không trùng mật khẩu cũ
 * - Hiển thị đúng lỗi từ server (sai mật khẩu cũ, quá nhiều lần thử, mật khẩu dễ đoán...)
 */
const ChangePasswordCard = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const strength = evaluatePassword(form.new_password)
  const confirmTouched = form.confirm_new_password.length > 0
  const confirmMatches = form.new_password === form.confirm_new_password

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setSuccess('')
    if (errors[name] || errors._global) {
      setErrors((prev) => ({ ...prev, [name]: '', _global: '' }))
    }
  }

  const validate = () => {
    const errs = {}
    if (!form.old_password) errs.old_password = 'Vui lòng nhập mật khẩu hiện tại.'

    if (!strength.valid) {
      errs.new_password = 'Mật khẩu mới chưa đạt yêu cầu bên dưới.'
    } else if (isTooLongForBcrypt(form.new_password)) {
      errs.new_password = 'Mật khẩu quá dài (tối đa 72 ký tự).'
    } else if (form.new_password === form.old_password) {
      errs.new_password = 'Mật khẩu mới không được trùng với mật khẩu hiện tại.'
    }

    if (!form.confirm_new_password) {
      errs.confirm_new_password = 'Vui lòng nhập lại mật khẩu mới.'
    } else if (!confirmMatches) {
      errs.confirm_new_password = 'Xác nhận mật khẩu không khớp.'
    }
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccess('')

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})

    setLoading(true)
    try {
      await axiosClient.post('/auth/change-password', {
        old_password: form.old_password,
        new_password: form.new_password,
      })
      setForm(EMPTY_FORM)
      setSuccess('Đổi mật khẩu thành công! Đang chuyển về trang đăng nhập...')
      // Mọi phiên đăng nhập cũ (kể cả phiên này) đã bị vô hiệu hóa → đăng nhập lại
      setTimeout(async () => {
        try { await logout() } catch { /* token cũ đã hết hiệu lực, bỏ qua */ }
        navigate('/login', { replace: true })
      }, 1500)
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data

      if (status === 400) {
        // Sai mật khẩu hiện tại
        setErrors({ old_password: data?.message || 'Mật khẩu hiện tại không đúng.' })
      } else if (status === 422 && Array.isArray(data?.errors) && data.errors.length > 0) {
        const mapped = {}
        data.errors.forEach(({ field, message }) => { mapped[field] = message })
        setErrors(mapped)
      } else if (status === 429) {
        setErrors({ _global: data?.message || 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ít phút.' })
      } else {
        setErrors({ _global: data?.message || 'Đổi mật khẩu thất bại. Vui lòng thử lại.' })
      }
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !loading && form.old_password && strength.valid && confirmTouched && confirmMatches

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="border-b border-gray-100 pb-3 mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Đổi mật khẩu</h3>
        <p className="text-xs text-gray-500 mt-1">
          Dùng mật khẩu dài, không trùng với mật khẩu ở các dịch vụ khác và không chứa email hay số điện thoại của bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Trường ẩn giúp trình quản lý mật khẩu của trình duyệt nhận đúng tài khoản */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={user?.email || ''}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />

        {errors._global && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
            {errors._global}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700" role="status">
            {success}
            <p className="text-xs text-green-600 mt-1">
              Các thiết bị khác đang đăng nhập bằng mật khẩu cũ cũng đã bị đăng xuất.
            </p>
          </div>
        )}

        <PasswordField
          label="Mật khẩu hiện tại"
          name="old_password"
          value={form.old_password}
          onChange={handleChange}
          error={errors.old_password}
          autoComplete="current-password"
          disabled={loading}
        />

        <PasswordField
          label="Mật khẩu mới"
          name="new_password"
          value={form.new_password}
          onChange={handleChange}
          error={errors.new_password}
          autoComplete="new-password"
          disabled={loading}
        >
          <PasswordStrength password={form.new_password} />
        </PasswordField>

        <PasswordField
          label="Xác nhận mật khẩu mới"
          name="confirm_new_password"
          value={form.confirm_new_password}
          onChange={handleChange}
          error={errors.confirm_new_password}
          autoComplete="new-password"
          disabled={loading}
        >
          {confirmTouched && !errors.confirm_new_password && (
            <p className={`mt-1 text-xs ${confirmMatches ? 'text-green-600' : 'text-red-600'}`}>
              {confirmMatches ? '✓ Mật khẩu khớp' : 'Mật khẩu chưa khớp'}
            </p>
          )}
        </PasswordField>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ChangePasswordCard