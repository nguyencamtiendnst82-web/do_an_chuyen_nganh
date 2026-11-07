import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from './Feedback'
import axiosClient from '../api/axiosClient'

// Giãn cách tối thiểu giữa 2 lần bấm "Gửi lại" (server còn giới hạn 3 lần/giờ)
const RESEND_COOLDOWN_SECONDS = 30

/**
 * EmailVerificationNotice: nhắc người dùng xác minh email.
 * - Chỉ hiện khi user.email_verified === false (tài khoản cũ/nhân viên đã xác minh thì không thấy gì)
 * - Nút "Gửi lại thư xác minh" → POST /api/auth/resend-verification
 * - Tự kiểm tra lại khi người dùng quay về tab này (sau khi bấm link trong thư ở tab khác),
 *   và có nút "Tôi đã xác minh" để kiểm tra thủ công.
 * Hiển thị dạng dải cảnh báo ngay dưới header (đặt trong CustomerLayout).
 */
const EmailVerificationNotice = () => {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timer = useRef(null)

  const unverified = Boolean(user) && user.email_verified === false

  useEffect(() => () => clearInterval(timer.current), [])

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS)
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timer.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  // Lấy lại hồ sơ từ server để biết đã xác minh chưa
  const refresh = useCallback(async ({ silent }) => {
    setChecking(true)
    try {
      const res = await axiosClient.get('/auth/me')
      const fresh = res.data.data.user ?? res.data.data
      setUser(fresh)
      if (!silent) {
        if (fresh.email_verified) toast.success('Email của bạn đã được xác minh.')
        else toast.info('Email vẫn chưa được xác minh. Hãy bấm vào liên kết trong thư.')
      }
    } catch {
      if (!silent) toast.error('Không kiểm tra được trạng thái. Vui lòng thử lại.')
    } finally {
      setChecking(false)
    }
  }, [setUser, toast])

  // Quay lại tab sau khi bấm link xác minh → tự cập nhật
  useEffect(() => {
    if (!unverified) return undefined
    const onFocus = () => refresh({ silent: true })
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [unverified, refresh])

  const resend = async () => {
    setSending(true)
    try {
      const res = await axiosClient.post('/auth/resend-verification')
      if (res.data.data?.already_verified) {
        await refresh({ silent: false })
      } else {
        toast.success(`Đã gửi thư xác minh tới ${user.email}. Vui lòng kiểm tra hộp thư (cả mục Spam).`)
        startCooldown()
      }
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error('Bạn đã yêu cầu gửi lại quá nhiều lần. Vui lòng thử lại sau 1 giờ.')
      } else {
        toast.error(err.response?.data?.message || 'Không gửi được thư xác minh. Vui lòng thử lại.')
      }
    } finally {
      setSending(false)
    }
  }

  if (!unverified) return null

  const resendLabel = sending ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại thư xác minh'

  const actions = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <button
        type="button"
        onClick={resend}
        disabled={sending || cooldown > 0}
        className="text-sm font-medium text-pink-700 hover:text-pink-800 underline disabled:no-underline disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {resendLabel}
      </button>
      <button
        type="button"
        onClick={() => refresh({ silent: false })}
        disabled={checking}
        className="text-sm text-gray-600 hover:text-gray-900 underline disabled:no-underline disabled:opacity-60"
      >
        {checking ? 'Đang kiểm tra...' : 'Tôi đã xác minh'}
      </button>
    </div>
  )

  return (
    <div className="bg-amber-50 border-b border-amber-200" role="status">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4">
        <p className="text-sm text-amber-900">
          <span aria-hidden="true">✉️ </span>
          Email <strong className="font-semibold">{user.email}</strong> chưa được xác minh. Hãy kiểm tra hộp thư và bấm vào liên kết xác minh.
        </p>
        {actions}
      </div>
    </div>
  )
}

export default EmailVerificationNotice
