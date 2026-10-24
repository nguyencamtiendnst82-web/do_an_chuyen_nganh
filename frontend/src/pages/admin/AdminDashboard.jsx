import { useAuth } from '../../contexts/AuthContext'

const AdminDashboard = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bảng điều khiển Admin
        </h1>
        <p className="text-sm text-gray-500 mt-1">Xin chào, {user?.full_name}!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: '👥', label: 'Tổng người dùng', value: '—', color: 'text-purple-600 bg-purple-50' },
          { icon: '🗓️', label: 'Lịch hẹn tháng này', value: '—', color: 'text-blue-600 bg-blue-50' },
          { icon: '💰', label: 'Doanh thu tháng', value: '—', color: 'text-green-600 bg-green-50' },
          { icon: '⚠️', label: 'Sự cố chờ xử lý', value: '—', color: 'text-red-600 bg-red-50' },
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

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 text-sm text-purple-700">
        📌 Dashboard sẽ hiển thị thống kê thực tế sau khi tích hợp đầy đủ các phân hệ.
      </div>
    </div>
  )
}

export default AdminDashboard
