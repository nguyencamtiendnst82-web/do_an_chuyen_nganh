import { useState } from 'react'

/**
 * PasswordField: ô nhập mật khẩu có
 * - Nút hiện/ẩn mật khẩu
 * - Cảnh báo khi đang bật Caps Lock
 * - Hiển thị lỗi và gợi ý bên dưới
 */
const PasswordField = ({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  autoComplete,
  placeholder = '••••••••',
  disabled = false,
  children,
}) => {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const handleKey = (e) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLock(e.getModifierState('CapsLock'))
    }
  }

  const describedBy = [error ? `${name}-error` : null, hint ? `${name}-hint` : null]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      <div className="relative">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onKeyUp={handleKey}
          onKeyDown={handleKey}
          onBlur={() => setCapsLock(false)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={`w-full pl-3 pr-11 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-50 ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
          tabIndex={-1}
          className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-700"
        >
          {visible ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      {capsLock && (
        <p className="mt-1 text-xs text-amber-600" role="status">
          ⚠ Phím Caps Lock đang bật.
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-gray-400">{hint}</p>
      )}

      {children}
    </div>
  )
}

export default PasswordField