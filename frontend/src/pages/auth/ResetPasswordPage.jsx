import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axiosClient from '../../api/axiosClient'
import PasswordField from '../../components/PasswordField'
import PasswordStrength from '../../components/PasswordStrength'
import { evaluatePassword, isTooLongForBcrypt } from '../../utils/passwordStrength'

/**
 * ResetPasswordPage: đặt mật khẩu mới từ liên kết trong thư (/reset-password?token=...).
 * - Mã sai / hết hạn / đã dùng (server trả 400) → báo rõ và dẫn về trang "Quên mật khẩu"
 * - Lỗi chính sách mật khẩu (422) → hiện theo trường, mã VẪN dùng lại được
 * - Thành công → tự chuyển về trang đăng nhập
 */
const ResetPasswordPage = () => {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [form, setForm] = useState({ new_password: '', confirm_new_password: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [invalidLink, setInvalidLink] = useState(!/^[a-f0-9]{64}$/.test(token))
  const redirectTimer = useRef(null)

  useEffect(() => () => clearTimeout(redirectTimer.current), [])

  const strength = evaluatePassword(form.new_password)
  const confirmTouched = form.confirm_new_password.length > 0
  const confirmMatches = form.new_password === form.confirm_new_password

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name] || errors._global) setErrors((prev) => ({ ...prev, [name]: '', _global: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errs = {}
    if (!strength.valid) errs.new_password = 'Mật khẩu mới chưa đạt yêu cầu bên dưới.'
    else if (isTooLongForBcrypt(form.new_password)) errs.new_password = 'Mật khẩu quá dài (tối đa 72 ký tự).'
    if (!form.confirm_new_password) errs.confirm_new_password = 'Vui lòng nhập lại mật khẩu mới.'
    else if (!confirmMatches) errs.confirm_new_password = 'Xác nhận mật khẩu không khớp.'
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})

    setLoading(true)
    try {
      await axiosClient.post('/auth/reset-password', { token, new_password: form.new_password })
      setDone(true)
      redirectTimer.current = setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data
      if (status === 400) {
        setInvalidLink(true)
      } else if (status === 422 && Array.isArray(data?.errors) && data.errors.length > 0) {
        const mapped = {}
        data.errors.forEach(({ field, message }) => { mapped[field] = message })
        setErrors(mapped)
      } else if (status === 429) {
        setErrors({ _global: data?.message || 'Bạn thử quá nhiều lần. Vui lòng thử lại sau.' })
      } else {
        setErrors({ _global: data?.message || 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.' })
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <span className="text-5xl" aria-hidden="true">✅</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Đặt lại mật khẩu thành công</h1>
          <p className="mt-2 text-sm text-gray-600">
            Các thiết bị đang đăng nhập bằng mật khẩu cũ đã bị đăng xuất. Đang chuyển về trang đăng nhập...
          </p>
          <Link to="/login" className="mt-4 inline-block text-sm text-pink-600 font-medium hover:text-pink-700">Đăng nhập ngay</Link>
        </div>
      </div>
    )
  }

  if (invalidLink) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <span className="text-5xl" aria-hidden="true">⚠️</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Liên kết không hợp lệ</h1>
          <p className="mt-2 text-sm text-gray-600">
            Liên kết đặt lại mật khẩu đã hết hạn, đã được dùng hoặc không đúng. Hãy yêu cầu một liên kết mới.
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-block bg-pink-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700"
          >
            Yêu cầu liên kết mới
          </Link>
        </div>
      </div>
    )
  }

  const canSubmit = !loading && strength.valid && confirmTouched && confirmMatches

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <span className="text-4xl">🐾</span>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Đặt mật khẩu mới</h1>
            <p className="mt-1 text-sm text-gray-500">Dùng mật khẩu dài, không chứa email hay số điện thoại của bạn.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errors._global && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
                {errors._global}
              </div>
            )}

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

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-pink-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
