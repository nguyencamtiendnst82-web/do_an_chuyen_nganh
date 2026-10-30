import { STATUS_LABEL, STATUS_STYLE } from '../utils/appointment'

/** Nhãn trạng thái lịch hẹn */
const StatusBadge = ({ status }) => (
  <span className={`inline-block shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_STYLE[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
    {STATUS_LABEL[status] || status}
  </span>
)

export default StatusBadge
