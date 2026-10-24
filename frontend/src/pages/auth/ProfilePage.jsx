import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import axiosClient from '../../api/axiosClient'

/**
 * ProfilePage: Xem và chỉnh sửa hồ sơ cá nhân
 * - Cho phép cả 3 role: customer, staff, admin (hiển thị trong layout tương ứng)
 * - Form cập nhật: full_name, phone, address, avatar_url
 * - Form đổi mật khẩu: old_password, new_password
 */
const ProfilePage = () => {
  const { user, login } = useAuth()

  // Profile form
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    avatar_url: '',
  })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  // Password form
  const [pwForm, setPwForm] = useState({
    old_password: '',
    new_password: '',
    confirm_new_password: '',
  })
  const [pwErrors, setPwErrors] = useState({})
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  // Nạp dữ liệu user hiện tại
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        address: user.address || '',
        avatar_url: user.avatar_url || '',
      })
    }
  }, [user])

  const handleProfileChange = (e) => {
    const { name, value } = e.target
    setProfileForm((prev) => ({ ...prev, [name]: value }))
    if (profileErrors[name]) setProfileErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileSuccess('')
    setProfileErrors({})

    if (!profileForm.full_name.trim() || profileForm.full_name.trim().length < 2) {
      setProfileErrors({ full_name: 'Họ và tên phải có ít nhất 2 ký tự.' })
      return
    }

    setProfileLoading(true)
    try {
      const res = await axiosClient.put('/auth/me', {
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone || undefined,
        address: profileForm.address || null,
        avatar_url: profileForm.avatar_url || null,
      })
      setProfileSuccess('Cập nhật hồ sơ thành công!')
      // Cập nhật context (không cần re-login)
      const updatedUser = res.data.data.user
      setProfileForm({
        full_name: updatedUser.full_name || '',
        phone: updatedUser.phone || '',
        address: updatedUser.address || '',
        avatar_url: updatedUser.avatar_url || '',
      })
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 422 && data?.errors) {
        const errs = {}
        data.errors.forEach(({ field, message }) => { errs[field] = message })
        setProfileErrors(errs)
      } else {
        setProfileErrors({ _global: data?.message || 'Cập nhật thất bại.' })
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePwChange = (e) => {
    const { name, value } = e.target
    setPwForm((prev) => ({ ...prev, [name]: value }))
    if (pwErrors[name]) setPwErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handlePwSubmit = async (e) => {
    e.preventDefault()
    setPwSuccess('')
    setPwErrors({})

    if (!pwForm.old_password) {
      setPwErrors({ old_password: 'Vui lòng nhập mật khẩu cũ.' })
      return
    }
    if (!/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(pwForm.new_password)) {
      setPwErrors({ new_password: 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số.' })
      return
    }
    if (pwForm.new_password !== pwForm.confirm_new_password) {
      setPwErrors({ confirm_new_password: 'Xác nhận mật khẩu không khớp.' })
      return
    }

    setPwLoading(true)
    try {
      await axiosClient.post('/auth/change-password', {
        old_password: pwForm.old_password,
        new_password: pwForm.new_password,
      })
      setPwSuccess('Đổi mật khẩu thành công!')
      setPwForm({ old_password: '', new_password: '', confirm_new_password: '' })
    } catch (err) {
      const data = err.response?.data
      if (err.response?.status === 400) {
        setPwErrors({ old_password: data?.message || 'Mật khẩu cũ không đúng.' })
      } else {
        setPwErrors({ _global: data?.message || 'Đổi mật khẩu thất bại.' })
      }
    } finally {
      setPwLoading(false)
    }
  }

  const roleColors = {
    admin: 'text-purple-600 bg-purple-50',
    staff: 'text-blue-600 bg-blue-50',
    customer: 'text-pink-600 bg-pink-50',
  }
  const roleColor = roleColors[user?.role_name] || 'text-gray-600 bg-gray-50'

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý thông tin tài khoản của bạn</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        {/* Avatar + Info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-2xl font-bold">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
              : user?.full_name?.[0]?.toUpperCase()
            }
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user?.full_name}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
              {user?.role_display_name || user?.role_name}
            </span>
          </div>
        </div>

        {/* Profile form */}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2">Thông tin cơ bản</h3>

          {profileErrors._global && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {profileErrors._global}
            </div>
          )}
          {profileSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              {profileSuccess}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: 'full_name', label: 'Họ và tên', type: 'text' },
              { name: 'phone', label: 'Số điện thoại', type: 'tel' },
            ].map(({ name, label, type }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  name={name}
                  type={type}
                  value={profileForm[name]}
                  onChange={handleProfileChange}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${profileErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                />
                {profileErrors[name] && <p className="mt-1 text-xs text-red-600">{profileErrors[name]}</p>}
              </div>
            ))}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-400">Email không thể thay đổi</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
            <textarea
              name="address"
              rows={2}
              value={profileForm.address}
              onChange={handleProfileChange}
              placeholder="Địa chỉ liên hệ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL ảnh đại diện</label>
            <input
              name="avatar_url"
              type="url"
              value={profileForm.avatar_url}
              onChange={handleProfileChange}
              placeholder="https://example.com/avatar.jpg"
              className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${profileErrors.avatar_url ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {profileErrors.avatar_url && <p className="mt-1 text-xs text-red-600">{profileErrors.avatar_url}</p>}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileLoading}
              className="bg-pink-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-100 pb-2 mb-4">Đổi mật khẩu</h3>

        <form onSubmit={handlePwSubmit} className="space-y-4">
          {pwErrors._global && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {pwErrors._global}
            </div>
          )}
          {pwSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              {pwSuccess}
            </div>
          )}

          {[
            { name: 'old_password', label: 'Mật khẩu hiện tại' },
            { name: 'new_password', label: 'Mật khẩu mới' },
            { name: 'confirm_new_password', label: 'Xác nhận mật khẩu mới' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                name={name}
                type="password"
                value={pwForm[name]}
                onChange={handlePwChange}
                placeholder="••••••••"
                autoComplete={name === 'old_password' ? 'current-password' : 'new-password'}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${pwErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              {pwErrors[name] && <p className="mt-1 text-xs text-red-600">{pwErrors[name]}</p>}
            </div>
          ))}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwLoading}
              className="bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {pwLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProfilePage
