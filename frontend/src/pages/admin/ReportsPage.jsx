import { useState, useEffect } from 'react'
import {
  getRevenueReport,
  getServicesReport,
  getEmployeesReport,
  getAppointmentsReport,
  getCustomersReport,
  exportReportCsv,
} from '../../api/reportsApi'
import { addDays, vietnamYmd } from '../../utils/date'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const formatVND = (val) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0)

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('revenue')
  const [dateRange, setDateRange] = useState(() => {
    const today = vietnamYmd()
    return {
      from: addDays(today, -30),
      to: today,
      groupBy: 'day',
    }
  })

  const [revenueData, setRevenueData] = useState([])
  const [servicesData, setServicesData] = useState([])
  const [employeesData, setEmployeesData] = useState([])
  const [appointmentsData, setAppointmentsData] = useState(null)
  const [customersData, setCustomersData] = useState(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadCurrentTab = async () => {
    setLoading(true)
    setError('')
    try {
      if (activeTab === 'revenue') {
        const res = await getRevenueReport(dateRange)
        setRevenueData(res.data.data)
      } else if (activeTab === 'services') {
        const res = await getServicesReport({ from: dateRange.from, to: dateRange.to })
        setServicesData(res.data.data)
      } else if (activeTab === 'employees') {
        const res = await getEmployeesReport({ from: dateRange.from, to: dateRange.to })
        setEmployeesData(res.data.data)
      } else if (activeTab === 'appointments') {
        const res = await getAppointmentsReport({ from: dateRange.from, to: dateRange.to })
        setAppointmentsData(res.data.data)
      } else if (activeTab === 'customers') {
        const res = await getCustomersReport({ from: dateRange.from, to: dateRange.to })
        setCustomersData(res.data.data)
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi tải dữ liệu báo cáo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCurrentTab()
  }, [activeTab, dateRange.from, dateRange.to, dateRange.groupBy])

  const handleExportCsv = async () => {
    try {
      const endpoint = `/reports/${activeTab}`
      const params = { from: dateRange.from, to: dateRange.to }
      if (activeTab === 'revenue') params.groupBy = dateRange.groupBy

      const res = await exportReportCsv(endpoint, params)
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `bao_cao_${activeTab}_${dateRange.from}_${dateRange.to}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      alert('Không thể xuất file CSV: ' + (err.response?.data?.message || err.message))
    }
  }

  const tabs = [
    { key: 'revenue', label: 'Doanh thu', icon: '💵' },
    { key: 'services', label: 'Dịch vụ bán chạy', icon: '✂️' },
    { key: 'employees', label: 'Hiệu suất nhân viên', icon: '👨‍⚕️' },
    { key: 'appointments', label: 'Lịch & Khung giờ', icon: '📅' },
    { key: 'customers', label: 'Khách hàng', icon: '👥' },
  ]

  return (
    <div className="space-y-6">
      {/* Tiêu đề & Nút xuất file */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo & Thống kê</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tổng hợp dữ liệu kinh doanh, hiệu suất và khách hàng
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition shadow-xs"
        >
          📥 Xuất CSV (Excel)
        </button>
      </div>

      {/* Bộ lọc khoảng ngày */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium">Từ ngày:</span>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium">Đến ngày:</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {activeTab === 'revenue' && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">Gom nhóm:</span>
            <select
              value={dateRange.groupBy}
              onChange={(e) => setDateRange({ ...dateRange, groupBy: e.target.value })}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="day">Theo ngày</option>
              <option value="month">Theo tháng</option>
            </select>
          </div>
        )}

        <button
          onClick={loadCurrentTab}
          disabled={loading}
          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
        >
          {loading ? 'Đang lọc...' : 'Lọc'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition ${
              activeTab === t.key
                ? 'bg-white text-purple-700 border-t-2 border-purple-600 shadow-xs'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Lỗi nếu có */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Nội dung Tab */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400">
            Đang tải dữ liệu báo cáo...
          </div>
        ) : (
          <>
            {/* 1. TAB DOANH THU */}
            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-gray-900">Biểu đồ doanh thu</h3>
                {revenueData.length === 0 ? (
                  <p className="text-gray-400 text-center py-10">Không có hóa đơn đã thanh toán trong kỳ này.</p>
                ) : (
                  <>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="period" />
                          <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                          <Tooltip formatter={(v) => formatVND(v)} />
                          <Legend />
                          <Bar dataKey="total_revenue" name="Doanh thu (VNĐ)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-gray-700">Kỳ ({dateRange.groupBy === 'month' ? 'Tháng' : 'Ngày'})</th>
                            <th className="px-4 py-3 font-semibold text-gray-700 text-right">Số lượng hóa đơn</th>
                            <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tổng doanh thu</th>
                            <th className="px-4 py-3 font-semibold text-gray-700 text-right">Trung bình/Hóa đơn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {revenueData.map((row) => (
                            <tr key={row.period} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{row.period}</td>
                              <td className="px-4 py-3 text-right">{row.invoice_count}</td>
                              <td className="px-4 py-3 text-right font-medium text-purple-700">{formatVND(row.total_revenue)}</td>
                              <td className="px-4 py-3 text-right">{formatVND(row.avg_per_invoice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 2. TAB DỊCH VỤ */}
            {activeTab === 'services' && (
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-gray-900">Dịch vụ bán chạy nhất</h3>
                {servicesData.length === 0 ? (
                  <p className="text-gray-400 text-center py-10">Chưa có dịch vụ nào hoàn tất trong kỳ này.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-gray-700">Mã DV</th>
                          <th className="px-4 py-3 font-semibold text-gray-700">Tên dịch vụ</th>
                          <th className="px-4 py-3 font-semibold text-gray-700 text-right">Số lượt đặt</th>
                          <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tổng doanh thu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {servicesData.map((s) => (
                          <tr key={s.service_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-500">#{s.service_id}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">{s.service_name}</td>
                            <td className="px-4 py-3 text-right font-semibold text-blue-600">{s.booking_count} lượt</td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatVND(s.total_revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 3. TAB NHÂN VIÊN */}
            {activeTab === 'employees' && (
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-gray-900">Hiệu suất và tỉ lệ hủy theo nhân viên</h3>
                {employeesData.length === 0 ? (
                  <p className="text-gray-400 text-center py-10">Chưa có dữ liệu nhân viên.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-gray-700">Tên nhân viên</th>
                          <th className="px-4 py-3 font-semibold text-gray-700">Điện thoại</th>
                          <th className="px-4 py-3 font-semibold text-gray-700 text-right">Lịch hoàn tất</th>
                          <th className="px-4 py-3 font-semibold text-gray-700 text-right">Lịch hủy</th>
                          <th className="px-4 py-3 font-semibold text-gray-700 text-right">Tỉ lệ hủy</th>
                          <th className="px-4 py-3 font-semibold text-gray-700 text-right">Doanh thu phụ trách</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {employeesData.map((e) => (
                          <tr key={e.employee_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{e.employee_name}</td>
                            <td className="px-4 py-3 text-gray-500">{e.phone}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{e.completed_count}</td>
                            <td className="px-4 py-3 text-right text-red-500">{e.cancelled_count}</td>
                            <td className="px-4 py-3 text-right font-medium">{e.cancel_rate}%</td>
                            <td className="px-4 py-3 text-right font-medium text-purple-700">{formatVND(e.total_revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4. TAB LỊCH & KHUNG GIỜ */}
            {activeTab === 'appointments' && (
              <div className="space-y-6">
                <h3 className="text-base font-semibold text-gray-900">Khung giờ cao điểm trong ngày</h3>
                {(!appointmentsData?.peak_hours || appointmentsData.peak_hours.length === 0) ? (
                  <p className="text-gray-400 text-center py-10">Không có dữ liệu khung giờ.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={appointmentsData.peak_hours}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="hour_slot" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="appointment_count" name="Số lượt hẹn" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* 5. TAB KHÁCH HÀNG */}
            {activeTab === 'customers' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <p className="text-sm text-purple-600 font-medium">Tổng số khách hàng</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">{customersData?.total_customers || 0}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <p className="text-sm text-blue-600 font-medium">Khách hàng quay lại (≥ 2 lịch)</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">{customersData?.returning_customers || 0}</p>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-gray-900">Khách hàng mới theo ngày</h3>
                {(!customersData?.new_customers_by_date || customersData.new_customers_by_date.length === 0) ? (
                  <p className="text-gray-400 text-center py-6">Không có khách hàng mới đăng ký trong kỳ này.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customersData.new_customers_by_date}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="new_count" name="Khách mới" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ReportsPage
