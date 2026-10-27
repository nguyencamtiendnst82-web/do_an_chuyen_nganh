/** Khung xương hiển thị trong lúc tải dữ liệu (thay cho chữ "Đang tải...") */
const Bar = ({ className = '' }) => <div className={`bg-gray-200 rounded animate-pulse ${className}`} />

export const CardSkeletonGrid = ({ count = 4, columns = 'grid-cols-1 sm:grid-cols-2' }) => (
  <ul className={`grid ${columns} gap-4`} aria-busy="true" aria-label="Đang tải">
    {Array.from({ length: count }).map((_, i) => (
      <li key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2"><Bar className="h-4 w-2/3" /><Bar className="h-3 w-1/3" /></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2"><Bar className="h-8" /><Bar className="h-8" /><Bar className="h-8" /></div>
      </li>
    ))}
  </ul>
)

export const ListSkeleton = ({ rows = 5 }) => (
  <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100" aria-busy="true" aria-label="Đang tải">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-4 py-4">
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-2"><Bar className="h-4 w-1/3" /><Bar className="h-3 w-1/2" /></div>
        <Bar className="h-4 w-16" />
      </div>
    ))}
  </div>
)

export default Bar
