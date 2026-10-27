import { useEffect, useState } from 'react'
import axiosClient from '../api/axiosClient'

/**
 * CustomerPicker: ô tìm khách hàng theo tên / số điện thoại / email (dùng cho nhân viên, admin).
 * value = khách đã chọn ({ id, full_name, phone }) hoặc null.
 */
const CustomerPicker = ({ value, onChange, error }) => {
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (value || !open) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await axiosClient.get('/customers', { params: { search: keyword.trim() || undefined, limit: 8 } })
        if (!cancelled) setResults(res.data.data.customers)
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [keyword, open, value])

  if (value) {
    return (
      <div className={`flex items-center justify-between gap-3 border rounded-lg px-3 py-2 text-sm bg-pink-50/50 ${error ? 'border-red-400' : 'border-gray-300'}`}>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{value.full_name}</p>
          <p className="text-xs text-gray-500">{value.phone}</p>
        </div>
        <button type="button" onClick={() => { onChange(null); setKeyword('') }} className="text-sm text-pink-600 hover:underline shrink-0">Đổi khách</button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input type="search" value={keyword} autoComplete="off"
        onChange={(e) => { setKeyword(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Gõ tên hoặc số điện thoại khách..." aria-label="Tìm khách hàng"
        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${error ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
      {open && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto text-sm">
          {loading ? (
            <li className="px-3 py-2 text-gray-500">Đang tìm...</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-gray-500">Không tìm thấy khách hàng.</li>
          ) : results.map((c) => (
            <li key={c.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(c); setOpen(false) }}
                className="w-full text-left px-3 py-2 hover:bg-pink-50">
                <span className="font-medium text-gray-900">{c.full_name}</span>
                <span className="block text-xs text-gray-500">{c.phone}{c.email ? ` · ${c.email}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

export default CustomerPicker
