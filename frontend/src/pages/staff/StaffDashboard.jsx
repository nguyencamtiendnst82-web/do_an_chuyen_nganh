import { useAuth } from '../../contexts/AuthContext'

const StaffDashboard = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Xin chào, {user?.full_name}! 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">Chào mừng đến Bảng điều khiển nhân viên</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: '📅', label: 'Lịch hẹn hôm nay', value: '—', color: 'text-blue-600 bg-blue-50' },
          { icon: '✅', label: 'Đã hoàn thành', value: '—', color: 'text-green-600 bg-green-50' },
          { icon: '⏳', label: 'Đang chờ', value: '—', color: 'text-yellow-600 bg-yellow-50' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${color} mb-3`}>
              {icon}
            </div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-700">
        📌 Các chức năng quản lý lịch hẹn sẽ được bổ sung ở phân hệ tiếp theo.
      </div>
    </div>
  )
}

export default StaffDashboard
