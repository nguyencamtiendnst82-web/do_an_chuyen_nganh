import { useState } from 'react'
import { Link } from 'react-router-dom'
import axiosClient from '../../api/axiosClient'

/**
 * ForgotPasswordPage: nhập email để nhận liên kết đặt lại mật khẩu.
 * Server luôn trả cùng một thông báo dù email có tồn tại hay không (không lộ email đã đăng ký),
 * nên trang này cũng chỉ báo chung "nếu email tồn tại thì đã gửi thư".
 */
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const value = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Email không hợp lệ.')
      return
    }

    setLoading(true)
    try {
      await axiosClient.post('/auth/forgot-password', { email: value })
      setSentTo(value)
    } catch (err) {
      const status = err.response?.status
      if (status === 429) {
        setError(err.response?.data?.message || 'Bạn yêu cầu quá nhiều lần. Vui lòng thử lại sau.')
      } else if (status === 422) {
        setError('Email không hợp lệ.')
      } else {
        setError(err.response?.data?.message || 'Không gửi được yêu cầu. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <span className="text-5xl" aria-hidden="true">✉️</span>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Kiểm tra hộp thư của bạn</h1>
          <p className="mt-2 text-sm text-gray-600">
            Nếu <strong>{sentTo}</strong> đã đăng ký tài khoản, chúng tôi vừa gửi hướng dẫn đặt lại mật khẩu.
            Liên kết có hiệu lực trong <strong>60 phút</strong>. Hãy xem cả mục Spam nếu chưa thấy thư.
          </p>
          <button
            type="button"
            onClick={() => setSentTo('')}
            className="mt-6 text-sm text-pink-600 font-medium hover:text-pink-700"
          >
            Nhập email khác hoặc gửi lại
          </button>
          <p className="mt-4 text-sm text-gray-600">
            <Link to="/login" className="text-pink-600 font-medium hover:text-pink-700">Quay lại đăng nhập</Link>
          </p>
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
            <h1 className="mt-3 text-2xl font-bold text-gray-900">Quên mật khẩu</h1>
            <p className="mt-1 text-sm text-gray-500">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Nhớ mật khẩu rồi?{' '}
            <Link to="/login" className="text-pink-600 font-medium hover:text-pink-700">Đăng nhập</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
