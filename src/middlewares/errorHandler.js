const { sendError } = require('../utils/response');

/**
 * Middleware xử lý lỗi tập trung toàn hệ thống
 */
const errorHandler = (err, req, res, next) => {
  const isTest = process.env.NODE_ENV === 'test';
  const isProd = process.env.NODE_ENV === 'production';

  // Lỗi JSON body sai cú pháp
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'Dữ liệu JSON gửi lên không hợp lệ', 400);
  }

  // Lỗi validate từ Zod
  if (err.name === 'ZodError') {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Dữ liệu gửi lên không đúng định dạng', 422, formattedErrors);
  }

  const statusCode = err.statusCode || err.status || 500;

  // Chỉ in chi tiết (stack) với lỗi hệ thống 5xx; lỗi 4xx là lỗi người dùng nên không ồn ào
  if (statusCode >= 500) {
    if (!isTest) console.error('❌ [Error Handler]:', err);
  } else if (!isTest) {
    console.warn(`⚠️ [${statusCode}] ${req.method} ${req.originalUrl}: ${err.message}`);
  }

  // Lỗi 5xx ở production không được lộ thông tin nội bộ (ví dụ lỗi SQL)
  const message =
    statusCode >= 500 && isProd
      ? 'Đã có lỗi xảy ra trên hệ thống'
      : err.message || 'Đã có lỗi xảy ra trên hệ thống';
  const errors = statusCode >= 500 && isProd ? null : err.errors || null;

  return sendError(res, message, statusCode, errors);
};

module.exports = errorHandler;