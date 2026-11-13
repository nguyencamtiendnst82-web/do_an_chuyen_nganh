import { useState, useEffect, useCallback } from 'react'
import axiosClient from '../../api/axiosClient'
import CareStepModal from '../../components/CareStepModal'
import { useToast } from '../../components/Feedback'
import { formatDateVN, vietnamYmd } from '../../utils/date'

const COLUMNS = [
  { key: 'confirmed', label: 'Đã xác nhận', color: 'bg-blue-50 text-blue-700 border-blue-200', actionText: 'Tiếp nhận' },
  { key: 'checked_in', label: 'Đã tiếp nhận', color: 'bg-purple-50 text-purple-700 border-purple-200', actionText: 'Bắt đầu làm' },
  { key: 'in_progress', label: 'Đang thực hiện', color: 'bg-pink-50 text-pink-700 border-pink-200', actionText: 'Hoàn tất' },
  { key: 'completed', label: 'Đã hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', actionText: null },
]

const StaffKanbanPage = () => {
  const toast = useToast()

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // State cho Modal chăm sóc (Checkin / Complete)
  const [activeModal, setActiveModal] = useState(null) // { appointment, mode: 'checkin' | 'complete' }

  const loadTodayAppointments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Lấy danh sách lịch hôm nay (staff chỉ lấy lịch của mình qua backend filter)
      const today = vietnamYmd()
      const res = await axiosClient.get('/appointments', {
        params: {
          from: today,
          to: today,
          limit: 100,
        },
      })
      setAppointments(res.data.data.items || [])
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể tải lịch hẹn hôm nay.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTodayAppointments()
  }, [loadTodayAppointments])

  // Xử lý chuyển trạng thái: start (checked_in -> in_progress)
  const handleStartService = async (apt) => {
    if (!window.confirm(`Xác nhận bắt đầu thực hiện dịch vụ cho bé ${apt.pet_name}?`)) return
    try {
      await axiosClient.patch(`/appointments/${apt.id}/start`)
      toast.success(`Đã chuyển lịch của bé ${apt.pet_name} sang Đang thực hiện.`)
      loadTodayAppointments()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể bắt đầu dịch vụ.')
    }
  }

  // Click vào thẻ để thực hiện bước tiếp theo
  const handleCardClick = (apt) => {
    if (apt.status === 'confirmed') {
      setActiveModal({ appointment: apt, mode: 'checkin' })
    } else if (apt.status === 'checked_in') {
      handleStartService(apt)
    } else if (apt.status === 'in_progress') {
      setActiveModal({ appointment: apt, mode: 'complete' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Điều phối dịch vụ hôm nay (Kanban)</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ngày: <span className="font-semibold text-gray-700">{formatDateVN(vietnamYmd())}</span>. Bấm vào thẻ để thực hiện bước chăm sóc tiếp theo.
          </p>
        </div>
        <button
          onClick={loadTodayAppointments}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition shadow-xs"
        >
          🔄 Làm mới danh sách
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-96 bg-gray-200 rounded-2xl"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const columnItems = appointments.filter((a) => a.status === col.key)
            return (
              <div
                key={col.key}
                className="bg-gray-100/70 border border-gray-200 rounded-2xl p-4 flex flex-col min-h-[500px]"
              >
                {/* Header cột */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${col.color}`}>
                    {col.label}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    {columnItems.length}
                  </span>
                </div>

                {/* Danh sách thẻ */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {columnItems.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-gray-400">
                      Không có lịch nào
                    </div>
                  ) : (
                    columnItems.map((apt) => (
                      <div
                        key={apt.id}
                        onClick={() => handleCardClick(apt)}
                        className={`bg-white rounded-xl p-4 border border-gray-200 shadow-xs transition hover:shadow-md cursor-pointer ${
                          col.actionText ? 'hover:border-blue-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span className="font-mono font-medium">#{apt.appointment_code}</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded font-medium text-gray-700">
                            {apt.start_time?.slice(0, 5)} - {apt.end_time?.slice(0, 5)}
                          </span>
                        </div>

                        <p className="font-bold text-gray-900 text-base">{apt.pet_name}</p>
                        <p className="text-xs text-gray-500 capitalize">
                          {apt.pet_species} • {apt.customer_name} ({apt.customer_phone})
                        </p>

                        {apt.customer_notes && (
                          <div className="mt-2 p-2 bg-yellow-50 rounded-lg text-xs text-yellow-800">
                            <span className="font-medium">Lưu ý:</span> {apt.customer_notes}
                          </div>
                        )}

                        {col.actionText && (
                          <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                            <span className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                              👉 {col.actionText}
                            </span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Chăm sóc: Tiếp nhận hoặc Hoàn tất */}
      {activeModal && (
        <CareStepModal
          appointment={activeModal.appointment}
          mode={activeModal.mode}
          onClose={() => setActiveModal(null)}
          onDone={() => {
            setActiveModal(null)
            loadTodayAppointments()
          }}
        />
      )}
    </div>
  )
}

export default StaffKanbanPage
