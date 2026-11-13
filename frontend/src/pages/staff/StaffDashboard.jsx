import { useState, useEffect } from 'react'
import { getStaffDashboard } from '../../api/reportsApi'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'

const StaffDashboard = () => {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getStaffDashboard()
      setData(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải số liệu bảng điều khiển nhân viên.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
          ))}
        </div>
      </div>
    )
  }

  const todayApts = data?.my_appointments_today || []
  const completedToday = todayApts.filter((a) => a.status === 'completed').length
  const pendingOrInProgress = todayApts.filter((a) => ['confirmed', 'checked_in', 'in_progress'].includes(a.status)).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Xin chào, <span className="text-blue-600">{user?.full_name}</span>! 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Chào mừng bạn đến với Bảng điều khiển nhân viên</p>
        </div>
        <Link
          to="/staff/today"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition shadow-sm inline-flex items-center gap-2"
        >
          📋 Bảng điều phối hôm nay (Kanban)
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 3 Thẻ số liệu */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-blue-600 bg-blue-50 mb-3">
            📅
          </div>
          <p className="text-sm text-gray-500">Lịch của tôi hôm nay</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{todayApts.length} lịch</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-emerald-600 bg-emerald-50 mb-3">
            ✅
          </div>
          <p className="text-sm text-gray-500">Đã hoàn thành hôm nay</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{completedToday} lịch</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-purple-600 bg-purple-50 mb-3">
            🏆
          </div>
          <p className="text-sm text-gray-500">Đã làm trong tháng này</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{data?.completed_this_month || 0} lịch</p>
        </div>
      </div>

      {/* Thông tin ca làm việc hôm nay */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Ca làm việc hôm nay</h2>
        {data?.my_shift_today ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
            <div>
              <p className="font-bold text-blue-900 text-lg">{data.my_shift_today.shift_name}</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Thời gian: <span className="font-medium">{data.my_shift_today.start_time.slice(0, 5)} - {data.my_shift_today.end_time.slice(0, 5)}</span>
              </p>
              {data.my_shift_today.notes && (
                <p className="text-xs text-blue-600 mt-1 italic">Ghi chú: {data.my_shift_today.notes}</p>
              )}
            </div>
            <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-semibold self-start sm:self-auto">
              Đang trong lịch làm việc
            </span>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400 bg-gray-50 rounded-xl">
            Hôm nay bạn không có phân ca làm việc nào.
          </div>
        )}
      </div>

      {/* Lịch hôm nay đang chờ xử lý */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Danh sách chăm sóc hôm nay</h2>
          <Link to="/staff/today" className="text-sm text-blue-600 hover:underline font-medium">
            Mở Kanban toàn màn hình →
          </Link>
        </div>

        {todayApts.length === 0 ? (
          <p className="text-gray-400 text-center py-6">Hôm nay chưa có lịch hẹn nào được phân công cho bạn.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-gray-700">Khung giờ</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-700">Thú cưng</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-700">Khách hàng</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-700">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {todayApts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.start_time.slice(0, 5)} - {a.end_time.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{a.pet_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{a.species}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{a.customer_name}</p>
                      <p className="text-xs text-gray-500">{a.customer_phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default StaffDashboard
