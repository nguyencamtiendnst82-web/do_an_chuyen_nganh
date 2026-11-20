import { useCallback, useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'
import { useToast } from './Feedback'
import { errorMessage } from '../utils/format'
import { describeRequest } from './ChangeRequestModal'

/** Khách thấy đề xuất đang chờ của spa cho một lịch hẹn và chọn Đồng ý / Không đồng ý */
const ChangeRequestBanner = ({ appointmentId, onChanged }) => {
  const toast = useToast()
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await axiosClient.get(`/appointments/${appointmentId}/change-requests`)
      setRequest(res.data.data.requests.find((r) => r.status === 'pending') || null)
    } catch { setRequest(null) }
  }, [appointmentId])

  useEffect(() => { load() }, [load])

  const respond = async (accept) => {
    setBusy(true)
    try {
      await axiosClient.patch(`/appointments/change-requests/${request.id}/respond`, { accept })
      toast.success(accept ? 'Đã đồng ý. Lịch hẹn đã được cập nhật.' : 'Đã gửi phản hồi cho spa.')
      setRequest(null)
      onChanged?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Không gửi được phản hồi.'))
      load()
    } finally {
      setBusy(false)
    }
  }

  if (!request) return null
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-medium text-amber-900">Spa đề xuất: {describeRequest(request)}</p>
      {request.reason && <p className="text-amber-800 mt-0.5">Lý do: {request.reason}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={() => respond(true)} className="px-3 py-1.5 rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">Đồng ý</button>
        <button type="button" disabled={busy} onClick={() => respond(false)} className="px-3 py-1.5 rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-60">Không đồng ý</button>
      </div>
    </div>
  )
}

export default ChangeRequestBanner
