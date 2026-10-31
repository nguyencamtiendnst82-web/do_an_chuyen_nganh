import { createImageStore } from './uploadMedia.js';

/**
 * Ảnh thú cưng trước / sau khi làm dịch vụ (lịch sử chăm sóc).
 * Dùng chung cách làm với ảnh thú cưng: JPG/PNG/WEBP, tối đa 2MB, tên file UUID.
 * Đường dẫn công khai: /api/care-photos/<tên-file>
 */
const careImages = createImageStore('care', '/api/care-photos/');

export { careImages };
export default careImages;
