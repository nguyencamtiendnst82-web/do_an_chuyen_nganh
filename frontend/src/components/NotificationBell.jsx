import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import notificationApi from '../api/notificationApi'

const POLL_MS = 30000

const ICONS = {
  appointment_created: '📅',
  appointment_confirmed: '✅',
  appointment_cancelled: '❌',
  appointment_assigned: '👤',
  appointment_checked_in: '🐾',
  appointment_started: '✂️',
  appointment_completed: '🛁',
  new_invoice: '🧾',
  payment_received: '💳',
  incident_reported: '⚠️',
  incident_resolved: '🩹',
}

const timeAgo = (value) => {
  const diff = Math.max(0, Date.now() - new Date(value).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Vừa xong'
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  return new Date(value).toLocaleDateString('vi-VN')
}

/** Đường dẫn đích theo vai trò: payload.link chỉ là từ khóa, không phải URL */
const resolvePath = (link, role) => {
  const prefix = role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : ''
  switch (link) {
    case 'appointments': return `${prefix}/appointments`
    case 'incidents': return role === 'customer' ? null : `${prefix}/incidents`
    case 'care-book': return '/care-book'
    default: return null
  }
}

/**
 * NotificationBell: chuông thông báo (hỏi lại mỗi 30 giây khi tab đang mở).
 * Bấm vào một thông báo → đánh dấu đã đọc và chuyển tới trang liên quan.
 */
const NotificationBell = ({ tone = 'pink' }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const refreshCount = useCallback(async () => {
    try {
      const res = await notificationApi.unreadCount()
      setUnread(res.data?.data?.unread_count ?? 0)
    } catch { /* im lặng: lỗi mạng tạm thời không cần báo */ }
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await notificationApi.list({ limit: 15 })
      setItems(res.data?.data?.notifications ?? [])
      setUnread(res.data?.data?.unread_count ?? 0)
    } catch { /* giữ danh sách cũ */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!user) return undefined
    refreshCount()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshCount()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [user, refreshCount])

  useEffect(() => {
    if (!open) return undefined
    loadList()
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, loadList])

  if (!user) return null

  const handleClick = async (n) => {
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      setUnread((c) => Math.max(0, c - 1))
      notificationApi.markRead(n.id).catch(() => {})
    }
    // Thông báo hóa đơn của khách: mở thẳng hóa đơn (kể cả thông báo cũ đã tạo trước đây)
    const invoiceId = n.payload?.invoice_id
    const path = invoiceId && user.role_name === 'customer'
      ? `/appointments?invoice=${invoiceId}`
      : resolvePath(n.payload?.link, user.role_name)
    if (path) {
      setOpen(false)
      navigate(path)
    }
  }

  const handleReadAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
    setUnread(0)
    notificationApi.markAllRead().catch(() => {})
  }

  const accent = tone === 'blue' ? 'bg-blue-50' : 'bg-pink-50'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-label={unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative p-2 text-gray-500 hover:text-gray-900 rounded-full focus:outline-none"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 z-[60] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Thông báo</span>
            {unread > 0 && (
              <button type="button" onClick={handleReadAll} className="text-xs text-pink-600 hover:text-pink-700 font-medium">
                Đánh dấu đã đọc tất cả
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {loading && items.length === 0 && <li className="px-4 py-6 text-center text-sm text-gray-400">Đang tải...</li>}
            {!loading && items.length === 0 && <li className="px-4 py-8 text-center text-sm text-gray-400">Chưa có thông báo nào.</li>}
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 ${n.is_read ? '' : accent}`}
                >
                  <span className="text-lg shrink-0" aria-hidden="true">{ICONS[n.type] || '🔔'}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>{n.payload?.title}</span>
                    <span className="block text-xs text-gray-500 mt-0.5 break-words">{n.payload?.message}</span>
                    <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
