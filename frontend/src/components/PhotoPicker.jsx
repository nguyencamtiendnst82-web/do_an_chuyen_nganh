import { useEffect, useRef, useState } from 'react'

const MAX_SIZE = 2 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

/**
 * PhotoPicker: chọn ảnh từ thiết bị (chưa tải lên ngay; form cha tải khi bấm Lưu).
 * Props:
 *  - currentUrl: ảnh hiện có trên server (hoặc null)
 *  - file / onFile(file|null): ảnh mới đang chờ lưu
 *  - removed / onRemove(bool): đánh dấu xóa ảnh hiện có
 *  - fallback: nội dung hiển thị khi chưa có ảnh
 *  - shape: 'circle' | 'square'
 */
const PhotoPicker = ({ currentUrl, file, onFile, removed, onRemove, fallback, shape = 'circle', label = 'Ảnh' }) => {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!file) { setPreview(null); return undefined }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handlePick = (e) => {
    const picked = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng một file
    if (!picked) return
    if (!ACCEPT.includes(picked.type)) { setError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.'); return }
    if (picked.size > MAX_SIZE) { setError('Ảnh quá lớn. Dung lượng tối đa là 2MB.'); return }
    setError('')
    onRemove(false)
    onFile(picked)
  }

  const shown = preview || (!removed && currentUrl) || null
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  return (
    <div className="flex items-center gap-4">
      {shown ? (
        <img src={shown} alt={label} className={`w-20 h-20 object-cover ${rounded} border border-gray-200`} />
      ) : (
        <div className={`w-20 h-20 ${rounded} bg-gray-50 border border-dashed border-gray-300 flex items-center justify-center text-3xl text-gray-400`}>
          {fallback}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50">
            {shown ? 'Đổi ảnh' : 'Chọn ảnh'}
          </button>
          {shown && (
            <button type="button" onClick={() => { onFile(null); if (currentUrl) onRemove(true); setError('') }}
              className="text-sm text-red-600 rounded-lg px-3 py-1.5 hover:bg-red-50">
              Xóa ảnh
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">JPG, PNG hoặc WEBP, tối đa 2MB.</p>
        {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} onChange={handlePick} className="hidden" aria-label={label} />
      </div>
    </div>
  )
}

export default PhotoPicker
