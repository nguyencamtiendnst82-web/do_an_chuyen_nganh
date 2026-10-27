import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Feedback: thông báo (toast) tự tắt + hộp thoại xác nhận đẹp, thay cho window.confirm.
 *
 * Cách dùng trong component:
 *   const toast = useToast()
 *   toast.success('Đã lưu')   // tự tắt sau 4 giây
 *   toast.error('Có lỗi')     // tự tắt sau 6 giây
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title: 'Ẩn hồ sơ?', message: '...', confirmText: 'Ẩn', danger: true }))) return
 */
const ToastContext = createContext(null)
const ConfirmContext = createContext(null)

const TOAST_STYLE = {
  success: { box: 'bg-green-50 border-green-200 text-green-800', icon: '✓' },
  error: { box: 'bg-red-50 border-red-200 text-red-800', icon: '!' },
  info: { box: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'i' },
}

const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const nextId = useRef(1)
  const resolver = useRef(null)

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const push = useCallback((type, message, duration) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-3), { id, type, message }]) // tối đa 4 thông báo cùng lúc
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const toast = useMemo(() => ({
    success: (message) => push('success', message, 4000),
    error: (message) => push('error', message, 6000),
    info: (message) => push('info', message, 4000),
  }), [push])

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve
    setDialog(options)
  }), [])

  const answer = useCallback((value) => {
    resolver.current?.(value)
    resolver.current = null
    setDialog(null)
  }, [])

  useEffect(() => {
    if (!dialog) return undefined
    const onKey = (e) => { if (e.key === 'Escape') answer(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dialog, answer])

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={confirm}>
        {children}

        <div className="fixed z-[60] inset-x-4 bottom-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto flex flex-col gap-2 sm:w-96 pointer-events-none">
          {toasts.map((t) => {
            const style = TOAST_STYLE[t.type]
            return (
              <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'}
                className={`pointer-events-auto flex items-start gap-3 border rounded-xl shadow-lg px-4 py-3 text-sm ${style.box}`}>
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold" aria-hidden="true">{style.icon}</span>
                <p className="flex-1">{t.message}</p>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo" className="opacity-60 hover:opacity-100 leading-none text-lg">×</button>
              </div>
            )
          })}
        </div>

        {dialog && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40" onClick={() => answer(false)} aria-hidden="true" />
            <div role="alertdialog" aria-modal="true" aria-label={dialog.title}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
              <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl mb-3 ${dialog.danger ? 'bg-red-50 text-red-600' : 'bg-pink-50 text-pink-600'}`} aria-hidden="true">
                {dialog.danger ? '⚠' : '?'}
              </div>
              <h2 className="text-base font-semibold text-gray-900">{dialog.title}</h2>
              {dialog.message && <p className="mt-2 text-sm text-gray-600">{dialog.message}</p>}
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" autoFocus onClick={() => answer(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100">
                  {dialog.cancelText || 'Hủy'}
                </button>
                <button type="button" onClick={() => answer(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-pink-600 hover:bg-pink-700'}`}>
                  {dialog.confirmText || 'Đồng ý'}
                </button>
              </div>
            </div>
          </div>
        )}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  )
}

const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast phải được dùng bên trong <FeedbackProvider>')
  return ctx
}

const useConfirm = () => {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm phải được dùng bên trong <FeedbackProvider>')
  return ctx
}

export { FeedbackProvider, useToast, useConfirm }
