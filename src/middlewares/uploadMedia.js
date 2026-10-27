import multer from 'multer';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/**
 * Tải ảnh lên cho thú cưng và dịch vụ (dùng chung cách làm với ảnh đại diện):
 * - Chỉ nhận JPG / PNG / WEBP, tối đa 2MB
 * - Tên file do server sinh ngẫu nhiên, KHÔNG dùng tên file người dùng gửi
 * - Lỗi trả về 422 với thông báo tiếng Việt
 * Việc kiểm tra nội dung ảnh thật (magic bytes) làm ở tầng service bằng isRealImageFile.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

const MAX_SIZE = 2 * 1024 * 1024;
const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const unprocessable = (message) => {
  const err = new Error(message);
  err.statusCode = 422;
  return err;
};

/**
 * @param {string} folder    thư mục con trong uploads/ (VD: 'pets')
 * @param {string} urlPrefix đường dẫn công khai lưu vào CSDL (VD: '/api/pets/photos/')
 */
const createImageStore = (folder, urlPrefix) => {
  const dir = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename: (req, file, cb) => cb(null, crypto.randomUUID() + EXT_BY_MIME[file.mimetype]),
    }),
    fileFilter: (req, file, cb) => {
      if (!EXT_BY_MIME[file.mimetype]) {
        return cb(unprocessable('Chỉ chấp nhận ảnh định dạng JPG, PNG hoặc WEBP.'));
      }
      return cb(null, true);
    },
    limits: { fileSize: MAX_SIZE, files: 1 },
  });

  /** Middleware nhận 1 file ảnh ở field form-data tên `field` */
  const receive = (field) => (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        return next(
          unprocessable(err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh quá lớn. Dung lượng tối đa là 2MB.' : 'Tệp tải lên không hợp lệ.')
        );
      }
      return next(err);
    });
  };

  /** Xóa file ảnh cũ an toàn (chỉ file nằm trong thư mục của store này) */
  const remove = async (url) => {
    if (!url) return;
    const fullPath = path.join(dir, path.basename(url)); // chặn path traversal
    if (!fullPath.startsWith(dir + path.sep)) return;
    try {
      await fs.promises.unlink(fullPath);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[Upload] Không xóa được file cũ:', err.message);
    }
  };

  /** Xóa file vừa tải lên khi xử lý lỗi (tránh để lại file rác) */
  const discard = async (file) => {
    if (!file?.path) return;
    try {
      await fs.promises.unlink(file.path);
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('[Upload] Không xóa được file tạm:', err.message);
    }
  };

  /** Middleware phục vụ ảnh công khai, chỉ đọc (tên file là UUID khó đoán) */
  const serve = () =>
    express.static(dir, {
      index: false,
      dotfiles: 'ignore',
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    });

  return { dir, urlPrefix, receive, remove, discard, serve };
};

const petPhotos = createImageStore('pets', '/api/pets/photos/');
const serviceImages = createImageStore('services', '/api/services/images/');

export { createImageStore, petPhotos, serviceImages };
export default { createImageStore, petPhotos, serviceImages };
