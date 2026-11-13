import { useState, useEffect } from 'react'
import { getAdminDashboard } from '../../api/reportsApi'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

const STATUS_LABELS = {
  pending: { label: 'Chờ duyệt', color: '#f59e0b' },
  confirmed: { label: 'Đã xác nhận', color: '#3b82f6' },
  checked_in: { label: 'Đã tiếp nhận', color: '#8b5cf6' },
  in_progress: { label: 'Đang làm', color: '#ec4899' },
  completed: { label: 'Hoàn tất', color: '#10b981' },
  cancelled: { label: 'Đã hủy', color: '#ef4444' },
}

const formatVND = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)

const AdminDashboard = () => {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAdminDashboard()
      setData(res.data.data)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải số liệu bảng điều khiển.')
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
          <div className="h-64 bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
        <p className="font-semibold">Lỗi tải dữ liệu</p>
        <p className="text-sm mt-1">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
        >
          Thử lại
        </button>
      </div>
    )
  }

  const statusPieData = (data?.appointments_today_by_status || []).map((item) => ({
    name: STATUS_LABELS[item.status]?.label || item.status,
    value: item.count,
    color: STATUS_LABELS[item.status]?.color || '#6b7280',
  }))

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Lời chào */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển Quản trị</h1>
          <p className="text-sm text-gray-500 mt-1">
            Xin chào, <span className="font-medium text-gray-800">{user?.full_name}</span>! Dưới đây là tình hình hoạt động của Pet Spa hôm nay.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/reports"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
          >
            📈 Xem Báo cáo
          </Link>
          <Link
            to="/admin/logs"
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl text-sm font-medium transition shadow-sm"
          >
            📋 Nhật ký
          </Link>
        </div>
      </div>

      {/* 4 Thẻ số liệu chính */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-green-600 bg-green-50 mb-3">
            💵
          </div>
          <p className="text-sm text-gray-500">Doanh thu hôm nay</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatVND(data?.revenue_today)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-blue-600 bg-blue-50 mb-3">
            📅
          </div>
          <p className="text-sm text-gray-500">Lịch hẹn hôm nay</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data?.appointments_today_total || 0} lịch</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-purple-600 bg-purple-50 mb-3">
            💰
          </div>
          <p className="text-sm text-gray-500">Doanh thu tháng này</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatVND(data?.revenue_month)}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-red-600 bg-red-50 mb-3">
            ⚠️
          </div>
          <p className="text-sm text-gray-500">Sự cố đang mở</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{data?.open_incidents || 0}</p>
        </div>
      </div>

      {/* Biểu đồ tròn lịch hôm nay & Danh sách nhân viên trực */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Biểu đồ tròn trạng thái lịch */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Trạng thái lịch hẹn hôm nay</h2>
          {statusPieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <span className="text-3xl mb-2">🗓️</span>
              <p>Chưa có lịch hẹn nào trong hôm nay.</p>
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Nhân viên trực ca hôm nay */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Nhân viên trong ca hôm nay</h2>
          {(!data?.on_duty_employees_today || data.on_duty_employees_today.length === 0) ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-8">
              <span className="text-3xl mb-2">⏰</span>
              <p>Hôm nay chưa có nhân viên nào được phân ca.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-64 divide-y divide-gray-100">
              {data.on_duty_employees_today.map((shift, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{shift.employee_name}</p>
                    <p className="text-xs text-gray-500">
                      {shift.shift_name} ({shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)})
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 font-medium">
                    Đang trực
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
