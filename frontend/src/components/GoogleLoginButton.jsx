import { useEffect, useRef, useState } from 'react'
import axiosClient from '../api/axiosClient'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`)
    const script = existing || document.createElement('script')
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('load')))
    if (!existing) {
      script.src = GIS_SRC
      script.async = true
      document.head.appendChild(script)
    }
  })

/**
 * GoogleLoginButton: nút "Đăng nhập bằng Google" (Google Identity Services).
 * Khi người dùng chọn tài khoản, Google trả về một "credential"; ta gửi lên
 * POST /api/auth/google để server xác minh và trả { token, user }.
 *
 * onSuccess({ token, user, is_new }) — form cha lưu phiên đăng nhập và chuyển trang.
 * onError(message)                    — hiện lỗi cho người dùng.
 */
const GoogleLoginButton = ({ onSuccess, onError }) => {
  const holder = useRef(null)
  const callbacks = useRef({ onSuccess, onError })
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => { callbacks.current = { onSuccess, onError } })

  useEffect(() => {
    if (!CLIENT_ID) { setUnavailable(true); return undefined }
    let cancelled = false

    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async ({ credential }) => {
            try {
              const res = await axiosClient.post('/auth/google', { credential })
              callbacks.current.onSuccess(res.data.data)
            } catch (err) {
              callbacks.current.onError?.(err?.response?.data?.message || 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.')
            }
          },
        })
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', logo_alignment: 'left',
          width: Math.min(holder.current.offsetWidth || 320, 400),
        })
      })
      .catch(() => { if (!cancelled) setUnavailable(true) })

    return () => { cancelled = true }
  }, [])

  if (unavailable) {
    return (
      <p className="text-xs text-gray-400 text-center">
        Đăng nhập bằng Google hiện chưa sẵn sàng (thiếu cấu hình hoặc không kết nối được Google).
      </p>
    )
  }
  return <div ref={holder} className="flex justify-center w-full min-h-[44px]" />
}

export default GoogleLoginButton
