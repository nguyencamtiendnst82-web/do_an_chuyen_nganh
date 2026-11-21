import { formatDate } from '../utils/appointment'

const ICONS = {
  health: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  care: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5m4.75-11.396c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
  tip: 'M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
}

const Svg = ({ d, className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
)

const Photo = ({ url, label, tag, tagClass }) =>
  url ? (
    <a href={url} target="_blank" rel="noreferrer" className="group block relative overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
      <img src={url} alt={label} loading="lazy" className="w-full aspect-[4/3] object-cover transition-transform duration-300 group-hover:scale-105" />
      <span className={`absolute top-2 left-2 text-[11px] font-semibold px-2.5 py-1 rounded-full text-white ${tagClass}`}>{tag}</span>
    </a>
  ) : null

const Section = ({ icon, title, tone, children }) =>
  children ? (
    <section className="flex gap-3">
      <span className={`mt-0.5 w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${tone}`}>
        <Svg d={ICONS[icon]} />
      </span>
      <div className="min-w-0">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h4>
        <p className="mt-1 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{children}</p>
      </div>
    </section>
  ) : null

/**
 * CareRecordCard: một lần chăm sóc (tình trạng ban đầu, quá trình thực hiện, lời khuyên, ảnh trước/sau).
 * Dùng trong chi tiết lịch hẹn (nhân viên) và Sổ tay chăm sóc (khách).
 * badge: nhãn ngày hiển thị nổi bật ở đầu thẻ (tuỳ chọn).
 */
const CareRecordCard = ({ record, title, subtitle, badge }) => {
  const hasPhotos = record.photo_before_url || record.photo_after_url
  const empty = !record.initial_health_notes && !record.treatment_notes && !record.recommendations && !hasPhotos

  return (
    <article className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {(title || subtitle || badge) && (
        <header className="px-5 py-4 bg-pink-50/60 border-b border-pink-100 flex flex-wrap items-start gap-x-3 gap-y-1">
          {badge && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-700 bg-white border border-pink-200 rounded-full px-3 py-1">
              <Svg d={ICONS.calendar} className="w-3.5 h-3.5" />
              {badge}
            </span>
          )}
          <div className="min-w-0 flex-1 basis-48">
            {title && <h3 className="font-semibold text-gray-900 leading-snug">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </header>
      )}

      <div className="p-5 space-y-5">
        <Section icon="health" title="Tình trạng khi tiếp nhận" tone="bg-emerald-50 text-emerald-600">{record.initial_health_notes}</Section>
        <Section icon="care" title="Quá trình thực hiện" tone="bg-pink-50 text-pink-600">{record.treatment_notes}</Section>
        <Section icon="tip" title="Lời khuyên chăm sóc tại nhà" tone="bg-amber-50 text-amber-600">{record.recommendations}</Section>

        {hasPhotos && (
          <div className="grid grid-cols-2 gap-3">
            <Photo url={record.photo_before_url} label="Trước khi làm" tag="Trước" tagClass="bg-slate-800/75" />
            <Photo url={record.photo_after_url} label="Sau khi làm" tag="Sau" tagClass="bg-pink-600" />
          </div>
        )}
        {empty && <p className="text-sm text-gray-400">Chưa có ghi chú nào.</p>}
      </div>

      {record.employee_name && (
        <footer className="px-5 py-3 border-t border-gray-100 bg-gray-50/60 flex items-center gap-2 text-xs text-gray-500">
          <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-600 font-bold flex items-center justify-center">
            {record.employee_name.trim()[0]?.toUpperCase()}
          </span>
          <span>
            Thực hiện bởi <strong className="font-medium text-gray-700">{record.employee_name}</strong>
            {record.service_date ? ` · ${formatDate(record.service_date)}` : ''}
          </span>
        </footer>
      )}
    </article>
  )
}

export default CareRecordCard
