import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import axiosClient from '../../api/axiosClient'
import ChangePasswordCard from '../../components/ChangePasswordCard'

const MAX_AVATAR_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const CURRENT_YEAR = new Date().getFullYear()

const GENDER_OPTIONS = [
  { value: '', label: 'Không muốn nêu' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

/**
 * ProfilePage: Xem và chỉnh sửa hồ sơ cá nhân
 * - Cho phép cả 3 role: customer, staff, admin (hiển thị trong layout tương ứng)
 * - Form cập nhật: full_name, phone, address, gender, birth_year (dùng để xác định cách xưng hô)
 * - Ảnh đại diện: tải file từ máy lên (JPG/PNG/WEBP, tối đa 2MB)
 * - Đổi mật khẩu: component ChangePasswordCard
 */
const ProfilePage = () => {
  const auth = useAuth()
  const { user } = auth

  // Profile form
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    gender: '',
    birth_year: '',
  })
  const [profileErrors, setProfileErrors] = useState({})
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  // Avatar
  const fileInputRef = useRef(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)

  // Nạp dữ liệu user hiện tại
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        phone: user.phone || '',
        address: user.address || '',
        gender: user.gender || '',
        birth_year: user.birth_year ? String(user.birth_year) : '',
      })
    }
  }, [user])

  // Giải phóng URL xem trước khi đổi ảnh hoặc rời trang
  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    }
  }, [avatarPreview])

  /**
   * Cập nhật user trong AuthContext để ảnh hiện ngay trên header.
   * Dùng hàm mà AuthContext cung cấp; nếu không có thì tải lại trang.
   */
  const syncUserToContext = async (updatedUser) => {
    if (typeof auth.setUser === 'function') {
      auth.setUser(updatedUser)
    } else if (typeof auth.refreshUser === 'function') {
      await auth.refreshUser()
    } else {
      window.location.reload()
    }
  }

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
    if (profileForm.birth_year) {
      const year = Number(profileForm.birth_year)
      if (!Number.isInteger(year) || year < 1900 || year > CURRENT_YEAR - 5) {
        setProfileErrors({ birth_year: `Năm sinh phải từ 1900 đến ${CURRENT_YEAR - 5}.` })
        return
      }
    }

    setProfileLoading(true)
    try {
      const res = await axiosClient.put('/auth/me', {
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone || undefined,
        address: profileForm.address || null,
        gender: profileForm.gender || null,
        birth_year: profileForm.birth_year ? Number(profileForm.birth_year) : null,
      })
      setProfileSuccess('Cập nhật hồ sơ thành công!')
      const updatedUser = res.data.data.user
      setProfileForm({
        full_name: updatedUser.full_name || '',
        phone: updatedUser.phone || '',
        address: updatedUser.address || '',
        gender: updatedUser.gender || '',
        birth_year: updatedUser.birth_year ? String(updatedUser.birth_year) : '',
      })
      await syncUserToContext(updatedUser)
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

  // ----- Ảnh đại diện -----
  const handleAvatarSelect = (e) => {
    const file = e.target.files?.[0]
    setAvatarError('')
    setAvatarSuccess('')
    if (!file) return

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.')
      e.target.value = ''
      return
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setAvatarError('Ảnh quá lớn. Dung lượng tối đa là 2MB.')
      e.target.value = ''
      return
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const resetAvatarSelection = () => {
    setAvatarFile(null)
    setAvatarPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleAvatarUpload = async () => {
    if (!avatarFile) return
    setAvatarError('')
    setAvatarSuccess('')
    setAvatarLoading(true)

    try {
      const formData = new FormData()
      formData.append('avatar', avatarFile)

      const res = await axiosClient.post('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAvatarSuccess('Đã cập nhật ảnh đại diện!')
      resetAvatarSelection()
      await syncUserToContext(res.data.data.user)
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Tải ảnh lên thất bại. Vui lòng thử lại.')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleAvatarRemove = async () => {
    if (!window.confirm('Bạn có chắc muốn gỡ ảnh đại diện?')) return
    setAvatarError('')
    setAvatarSuccess('')
    setAvatarLoading(true)

    try {
      const res = await axiosClient.delete('/auth/me/avatar')
      setAvatarSuccess('Đã gỡ ảnh đại diện.')
      resetAvatarSelection()
      await syncUserToContext(res.data.data.user)
    } catch (err) {
      setAvatarError(err.response?.data?.message || 'Gỡ ảnh thất bại. Vui lòng thử lại.')
    } finally {
      setAvatarLoading(false)
    }
  }

  const roleColors = {
    admin: 'text-purple-600 bg-purple-50',
    staff: 'text-blue-600 bg-blue-50',
    customer: 'text-pink-600 bg-pink-50',
  }
  const roleColor = roleColors[user?.role_name] || 'text-gray-600 bg-gray-50'

  // Ảnh đang hiển thị: ưu tiên ảnh vừa chọn (xem trước), nếu không thì ảnh đang lưu
  const displayedAvatar = avatarPreview || user?.avatar_url

  const inputClass = (name) =>
    `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${profileErrors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'}`

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Tiêu đề trang */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hồ sơ cá nhân</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý thông tin và bảo mật tài khoản của bạn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Cột trái: danh tính + ảnh đại diện */}
        <aside className="bg-white rounded-2xl border border-gray-200 p-6 text-center lg:sticky lg:top-24">
          <div className="w-28 h-28 mx-auto rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-4xl font-bold overflow-hidden ring-4 ring-white shadow">
            {displayedAvatar
              ? <img src={displayedAvatar} alt="Ảnh đại diện" className="w-28 h-28 object-cover" />
              : user?.full_name?.[0]?.toUpperCase()
            }
          </div>

          <h2 className="mt-4 text-lg font-semibold text-gray-900 break-words">{user?.full_name}</h2>
          <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full ${roleColor}`}>
            {user?.role_display_name || user?.role_name}
          </span>

          <p className="mt-3 text-sm text-gray-500 break-all">{user?.email}</p>
          {user?.email_verified === true && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              ✓ Email đã xác minh
            </span>
          )}
          {user?.email_verified === false && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              Email chưa xác minh
            </span>
          )}

          {/* Ảnh đại diện: tải lên từ máy */}
          <div className="mt-6 pt-5 border-t border-gray-100 space-y-3">
            {avatarError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 text-left" role="alert">
                {avatarError}
              </div>
            )}
            {avatarSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 text-left" role="status">
                {avatarSuccess}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelect}
              className="hidden"
              id="avatar-input"
            />

            <div className="flex flex-wrap items-center justify-center gap-2">
              <label
                htmlFor="avatar-input"
                className="cursor-pointer border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {user?.avatar_url || avatarFile ? 'Đổi ảnh' : 'Chọn ảnh'}
              </label>

              {avatarFile && (
                <>
                  <button
                    type="button"
                    onClick={handleAvatarUpload}
                    disabled={avatarLoading}
                    className="bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {avatarLoading ? 'Đang tải lên...' : 'Lưu ảnh'}
                  </button>
                  <button
                    type="button"
                    onClick={resetAvatarSelection}
                    disabled={avatarLoading}
                    className="text-gray-600 px-3 py-2 text-sm hover:underline disabled:opacity-60"
                  >
                    Hủy
                  </button>
                </>
              )}

              {!avatarFile && user?.avatar_url && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  disabled={avatarLoading}
                  className="text-red-600 px-3 py-2 text-sm hover:underline disabled:opacity-60"
                >
                  {avatarLoading ? 'Đang xử lý...' : 'Gỡ ảnh'}
                </button>
              )}
            </div>

            <p className="text-xs text-gray-400">
              {avatarFile ? `Đã chọn: ${avatarFile.name}. ` : ''}
              JPG, PNG hoặc WEBP, tối đa 2MB.
            </p>
          </div>
        </aside>

        {/* Cột phải: thông tin + đổi mật khẩu */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleProfileSubmit} className="bg-white rounded-2xl border border-gray-200" noValidate>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Thông tin cá nhân</h3>
              <p className="text-xs text-gray-500 mt-0.5">Số điện thoại dùng để nhân viên liên hệ khi cần.</p>
            </div>

            <div className="p-6 space-y-5">
              {profileErrors._global && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700" role="alert">
                  {profileErrors._global}
                </div>
              )}
              {profileSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700" role="status">
                  {profileSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                  <input id="full_name" name="full_name" type="text" value={profileForm.full_name}
                    onChange={handleProfileChange} className={inputClass('full_name')} />
                  {profileErrors.full_name && <p className="mt-1 text-xs text-red-600">{profileErrors.full_name}</p>}
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                  <input id="phone" name="phone" type="tel" value={profileForm.phone}
                    onChange={handleProfileChange} className={inputClass('phone')} />
                  {profileErrors.phone && <p className="mt-1 text-xs text-red-600">{profileErrors.phone}</p>}
                </div>
              </div>

              {/* Email (chỉ đọc) */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Email là tên đăng nhập nên không thể thay đổi.
                  {user?.email_verified === false && ' Hãy dùng dải thông báo ở đầu trang để gửi lại thư xác minh.'}
                </p>
              </div>

              {/* Giới tính + năm sinh: để nhân viên biết cách xưng hô */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">Giới tính</label>
                  <select id="gender" name="gender" value={profileForm.gender} onChange={handleProfileChange}
                    className={`${inputClass('gender')} bg-white`}>
                    {GENDER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {profileErrors.gender && <p className="mt-1 text-xs text-red-600">{profileErrors.gender}</p>}
                </div>
                <div>
                  <label htmlFor="birth_year" className="block text-sm font-medium text-gray-700 mb-1">Năm sinh</label>
                  <input id="birth_year" name="birth_year" type="number" inputMode="numeric"
                    min={1900} max={CURRENT_YEAR - 5} value={profileForm.birth_year}
                    onChange={handleProfileChange} placeholder="VD: 1998" className={inputClass('birth_year')} />
                  {profileErrors.birth_year && <p className="mt-1 text-xs text-red-600">{profileErrors.birth_year}</p>}
                </div>
              </div>
              <p className="-mt-3 text-xs text-gray-400">
                Không bắt buộc. Thông tin này giúp nhân viên Pet Spa xưng hô với bạn cho phù hợp khi tiếp đón.
              </p>

              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <textarea id="address" name="address" rows={2} value={profileForm.address}
                  onChange={handleProfileChange} placeholder="Địa chỉ liên hệ"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl flex justify-end">
              <button
                type="submit"
                disabled={profileLoading}
                className="bg-pink-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>

          {/* Đổi mật khẩu */}
          <ChangePasswordCard />
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
