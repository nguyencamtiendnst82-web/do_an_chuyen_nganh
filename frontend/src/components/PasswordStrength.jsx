import { evaluatePassword } from '../utils/passwordStrength'

const LEVEL_STYLES = {
  1: { bar: 'bg-red-500', text: 'text-red-600' },
  2: { bar: 'bg-amber-500', text: 'text-amber-600' },
  3: { bar: 'bg-lime-500', text: 'text-lime-700' },
  4: { bar: 'bg-green-600', text: 'text-green-700' },
}

/**
 * PasswordStrength: thanh đo độ mạnh + danh sách yêu cầu của mật khẩu
 */
const PasswordStrength = ({ password }) => {
  const { level, label, checks } = evaluatePassword(password)

  if (level === 0) {
    return (
      <ul className="mt-2 space-y-0.5" aria-label="Yêu cầu mật khẩu">
        {checks.filter((c) => c.required).map((c) => (
          <li key={c.id} className="text-xs text-gray-400">○ {c.label}</li>
        ))}
      </ul>
    )
  }

  const style = LEVEL_STYLES[level]

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full ${i <= level ? style.bar : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${style.text}`}>{label}</span>
      </div>

      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5" aria-label="Yêu cầu mật khẩu">
        {checks.map((c) => (
          <li
            key={c.id}
            className={`text-xs ${c.ok ? 'text-green-600' : c.required ? 'text-gray-500' : 'text-gray-400'}`}
          >
            {c.ok ? '✓' : '○'} {c.label}
            {!c.required && <span className="text-gray-300"> (nên có)</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default PasswordStrength