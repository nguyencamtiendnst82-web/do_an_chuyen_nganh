import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __dirnameOf } from 'node:path';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnameOf(__filename);

/**
 * Middleware tải ảnh đại diện lên (dùng chung, có thể tái sử dụng cho ảnh thú cưng sau này)
 * - Chỉ nhận JPG / PNG / WEBP, tối đa 2MB
 * - Tên file do server tự sinh ngẫu nhiên, KHÔNG dùng tên file người dùng gửi
 * - Lỗi trả về 422 với thông báo tiếng Việt (không để rơi vào 500)
 */

// Thư mục gốc dự án / uploads / avatars
const AVATAR_DIR = path.join(__dirname, '..', '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT_BY_MIME[file.mimetype]),
});

const fileFilter = (req, file, cb) => {
  if (!EXT_BY_MIME[file.mimetype]) {
    const err = new Error('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.');
    err.statusCode = 422;
    return cb(err);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: 1 },
});

/**
 * Middleware nhận 1 file ảnh ở field form-data tên "avatar"
 */
const uploadAvatarImage = (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Ảnh quá lớn. Dung lượng tối đa là 2MB.'
          : 'Tệp tải lên không hợp lệ.';
      const e = new Error(message);
      e.statusCode = 422;
      return next(e);
    }
    return next(err);
  });
};

/**
 * Nhận diện định dạng thật của ảnh qua chữ ký (magic bytes),
 * để chặn trường hợp đổi đuôi file hoặc giả mimetype.
 * @param {Buffer} buf
 * @returns {'jpeg'|'png'|'webp'|null}
 */
const detectImageType = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
};

/**
 * Đọc đầu file trên đĩa và kiểm tra có đúng là ảnh thật không
 */
const isRealImageFile = async (filePath) => {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(12);
    await handle.read(buf, 0, 12, 0);
    return detectImageType(buf) !== null;
  } finally {
    await handle.close();
  }
};

/**
 * Xóa file avatar cũ một cách an toàn (chỉ xóa file nằm trong thư mục AVATAR_DIR)
 * @param {string|null} avatarUrl - giá trị lưu trong users.avatar_url
 */
const deleteAvatarFile = async (avatarUrl) => {
  if (!avatarUrl) return;
  const fileName = path.basename(avatarUrl); // chặn path traversal
  const fullPath = path.join(AVATAR_DIR, fileName);
  if (!fullPath.startsWith(AVATAR_DIR + path.sep)) return;
  try {
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[Avatar] Không xóa được file cũ:', err.message);
  }
};

// Đường dẫn công khai lưu vào CSDL (được phục vụ bởi authRoutes)
const AVATAR_URL_PREFIX = '/api/auth/avatars/';

export { AVATAR_DIR, AVATAR_URL_PREFIX, uploadAvatarImage, detectImageType, isRealImageFile, deleteAvatarFile };
export default { AVATAR_DIR, AVATAR_URL_PREFIX, uploadAvatarImage, detectImageType, isRealImageFile, deleteAvatarFile };