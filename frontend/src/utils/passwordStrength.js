/**
 * Đánh giá độ mạnh mật khẩu ở phía client (chỉ để hướng dẫn người dùng).
 * Việc kiểm tra bắt buộc vẫn do server thực hiện.
 */

// Giới hạn của bcrypt: chỉ dùng tối đa 72 byte đầu của mật khẩu
export const MAX_PASSWORD_BYTES = 72

export const getPasswordChecks = (password = '') => [
  { id: 'length', label: 'Ít nhất 8 ký tự', ok: password.length >= 8, required: true },
  { id: 'letter', label: 'Có chữ cái', ok: /[A-Za-z]/.test(password), required: true },
  { id: 'digit', label: 'Có chữ số', ok: /\d/.test(password), required: true },
  { id: 'mixed', label: 'Gồm cả chữ hoa và chữ thường', ok: /[a-z]/.test(password) && /[A-Z]/.test(password), required: false },
  { id: 'special', label: 'Có ký tự đặc biệt (ví dụ: ! @ # $)', ok: /[^A-Za-z0-9]/.test(password), required: false },
  { id: 'long', label: 'Từ 12 ký tự trở lên', ok: password.length >= 12, required: false },
]

/**
 * @returns {{ valid: boolean, level: 0|1|2|3|4, label: string, checks: Array }}
 *  level 0: chưa nhập, 1: chưa đạt, 2: trung bình, 3: mạnh, 4: rất mạnh
 */
export const evaluatePassword = (password = '') => {
  const checks = getPasswordChecks(password)

  if (!password) return { valid: false, level: 0, label: '', checks }

  const valid = checks.filter((c) => c.required).every((c) => c.ok)
  if (!valid) return { valid, level: 1, label: 'Chưa đạt yêu cầu', checks }

  const bonus = checks.filter((c) => !c.required && c.ok).length
  if (bonus === 0) return { valid, level: 2, label: 'Trung bình', checks }
  if (bonus === 1) return { valid, level: 3, label: 'Mạnh', checks }
  return { valid, level: 4, label: 'Rất mạnh', checks }
}

/**
 * Mật khẩu có vượt giới hạn 72 byte của bcrypt không (tính theo byte UTF-8)
 */
export const isTooLongForBcrypt = (password = '') =>
  new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES