import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axiosClient from '../../api/axiosClient'

/**
 * RegisterPage: Đăng ký tài khoản mới (chỉ customer)
 * - Validate client-side trước khi gửi
 * - Hiển thị lỗi từ server (409 trùng email/phone, 422 validation)
 * - Redirect /login sau khi đăng ký thành công
 */
const RegisterPage = () => {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Xóa lỗi field khi người dùng bắt đầu sửa
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  // Validate client-side
  const validate = () => {
    const errors = {}
    if (!form.full_name.trim() || form.full_name.trim().length < 2) {
      errors.full_name = 'Họ và tên phải có ít nhất 2 ký tự.'
    }
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Email không hợp lệ.'
    }
    if (!form.phone || !/^0\d{9}$/.test(form.phone)) {
      errors.phone = 'Số điện thoại phải là 10 chữ số và bắt đầu bằng 0.'
    }
    if (!form.password || !/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(form.password)) {
      errors.password = 'Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số.'
    }
    if (form.password !== form.confirm_password) {
      errors.confirm_password = 'Xác nhận mật khẩu không khớp.'
    }
    return errors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGlobalError('')
    setFieldErrors({})

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      await axiosClient.post('/auth/register', {
        full_name: form.full_name.trim(),
        email: form.email.toLowerCase(),
        phone: form.phone,
        password: form.password,
      })

      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 409) {
        // Trùng email hoặc phone
        const msg = data?.message || ''
        if (msg.toLowerCase().includes('email')) {
          setFieldErrors({ email: msg })
        } else if (msg.toLowerCase().includes('điện thoại')) {
          setFieldErrors({ phone: msg })
        } else {
          setGlobalError(msg)
        }
      } else if (err.response?.status === 422 && data?.errors) {
        // Lỗi validation từ server (Zod)
        const errs = {}
        data.errors.forEach(({ field, message }) => {
          errs[field] = message
        })
        setFieldErrors(errs)
      } else {
        setGlobalError(data?.message || 'Đăng ký thất bại. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { name: 'full_name', label: 'Họ và tên', type: 'text', placeholder: 'Nguyễn Văn A', autoComplete: 'name' },
    { name: 'email', label: 'Email', type: 'email', placeholder: 'email@example.com', autoComplete: 'email' },
    { name: 'phone', label: 'Số điện thoại', type: 'tel', placeholder: '09xxxxxxxx', autoComplete: 'tel' },
    { name: 'password', label: 'Mật khẩu', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
    { name: 'confirm_password', label: 'Xác nhận mật khẩu', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
  ]

  if (success) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
        <div className="text-center">
          <span className="text-5xl">✅</span>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Đăng ký thành công!</h2>
          <p className="mt-2 text-sm text-gray-500">Đang chuyển về trang đăng nhập...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-8">
            <span className="text-4xl">🐾</span>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Đăng ký tài khoản</h1>
            <p className="mt-1 text-sm text-gray-500">Tạo tài khoản để sử dụng dịch vụ Pet Spa</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {globalError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {globalError}
              </div>
            )}

            {fields.map(({ name, label, type, placeholder, autoComplete }) => (
              <div key={name}>
                <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1.5">
                  {label}
                </label>
                <input
                  id={name}
                  name={name}
                  type={type}
                  autoComplete={autoComplete}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={handleChange}
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${fieldErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {fieldErrors[name] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors[name]}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Đang đăng ký...' : 'Đăng ký'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-pink-600 font-medium hover:text-pink-700">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
