import { useState, useEffect } from 'react'
import { getSystemLogs } from '../../api/reportsApi'

const LogsPage = () => {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, total_pages: 1 })
  const [filters, setFilters] = useState({
    action: '',
    from: '',
    to: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedLog, setSelectedLog] = useState(null)

  const fetchLogs = async (page = 1) => {
    setLoading(true)
    setError('')
    try {
      const res = await getSystemLogs({ ...filters, page, limit: pagination.limit })
      setLogs(res.data.data.logs)
      setPagination(res.data.data.pagination)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải nhật ký hệ thống.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs(1)
  }, [])

  const handleFilterSubmit = (e) => {
    e.preventDefault()
    fetchLogs(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nhật ký hệ thống (Audit Trail)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi toàn bộ các thao tác ghi quan trọng của người dùng và quản trị viên
        </p>
      </div>

      {/* Bộ lọc */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium">Hành động:</span>
          <input
            type="text"
            placeholder="VD: CHECK_IN, CREATE..."
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium">Từ ngày:</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium">Đến ngày:</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition"
        >
          {loading ? 'Đang lọc...' : 'Lọc nhật ký'}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Danh sách log */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Đang tải nhật ký...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Không tìm thấy bản ghi nhật ký nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700">Thời gian</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Người thực hiện</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Hành động</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Thực thể</th>
                  <th className="px-4 py-3 font-semibold text-gray-700">Địa chỉ IP</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(log.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      {log.user_name ? (
                        <div>
                          <p className="font-medium text-gray-900">{log.user_name}</p>
                          <p className="text-xs text-gray-500">{log.user_email} ({log.role_name})</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Hệ thống</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 font-mono text-xs font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                      {log.entity_name} #{log.entity_id || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{log.ip_address || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium hover:underline"
                      >
                        Xem thay đổi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {pagination.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <span>
              Trang {pagination.page} / {pagination.total_pages} (Tổng {pagination.total} bản ghi)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchLogs(pagination.page - 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => fetchLogs(pagination.page + 1)}
                className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal xem old_values / new_values */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-gray-900 text-lg">
                Chi tiết thay đổi #{selectedLog.id} ({selectedLog.action})
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="bg-red-50/50 border border-red-200 p-3 rounded-xl">
                <p className="font-sans font-semibold text-red-700 mb-2">Giá trị trước đó (Old Values):</p>
                <pre className="whitespace-pre-wrap overflow-x-auto text-gray-800">
                  {selectedLog.old_values ? JSON.stringify(selectedLog.old_values, null, 2) : 'null'}
                </pre>
              </div>

              <div className="bg-green-50/50 border border-green-200 p-3 rounded-xl">
                <p className="font-sans font-semibold text-green-700 mb-2">Giá trị mới (New Values):</p>
                <pre className="whitespace-pre-wrap overflow-x-auto text-gray-800">
                  {selectedLog.new_values ? JSON.stringify(selectedLog.new_values, null, 2) : 'null'}
                </pre>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-medium transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LogsPage
