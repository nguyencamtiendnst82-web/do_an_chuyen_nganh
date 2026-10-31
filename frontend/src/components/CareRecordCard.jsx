import { formatDate } from '../utils/appointment'

const Photo = ({ url, label }) =>
  url ? (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={label} loading="lazy" className="w-full h-32 sm:h-40 object-cover rounded-lg border border-gray-200" />
      <span className="mt-1 block text-xs text-gray-500">{label}</span>
    </a>
  ) : null

const Block = ({ title, children }) =>
  children ? (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
      <p className="mt-0.5 text-sm text-gray-800 whitespace-pre-wrap">{children}</p>
    </div>
  ) : null

/**
 * CareRecordCard: một lần chăm sóc (tình trạng ban đầu, quá trình thực hiện, lời khuyên, ảnh trước/sau).
 * Dùng trong chi tiết lịch hẹn (nhân viên) và Sổ tay chăm sóc (khách).
 */
const CareRecordCard = ({ record, title, subtitle }) => {
  const hasPhotos = record.photo_before_url || record.photo_after_url
  const empty = !record.initial_health_notes && !record.treatment_notes && !record.recommendations && !hasPhotos

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {(title || subtitle) && (
        <header>
          {title && <h3 className="font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </header>
      )}
      <Block title="Tình trạng khi tiếp nhận">{record.initial_health_notes}</Block>
      <Block title="Quá trình thực hiện">{record.treatment_notes}</Block>
      <Block title="Lời khuyên chăm sóc tại nhà">{record.recommendations}</Block>
      {hasPhotos && (
        <div className="grid grid-cols-2 gap-3">
          <Photo url={record.photo_before_url} label="Trước khi làm" />
          <Photo url={record.photo_after_url} label="Sau khi làm" />
        </div>
      )}
      {empty && <p className="text-sm text-gray-400">Chưa có ghi chú nào.</p>}
      {record.employee_name && (
        <p className="text-xs text-gray-400">
          Thực hiện bởi {record.employee_name}
          {record.service_date ? ` · ${formatDate(record.service_date)}` : ''}
        </p>
      )}
    </article>
  )
}

export default CareRecordCard
