const { sendError } = require('../utils/response');

/**
 * Middleware xử lý lỗi tập trung toàn hệ thống
 */
const errorHandler = (err, req, res, next) => {
  // Ghi log lỗi để debug
  console.error('❌ [Error Handler]:', err);

  // Xử lý lỗi JSON body sai cú pháp
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'Dữ liệu JSON gửi lên không hợp lệ', 400);
  }

  // Xử lý lỗi validate từ Zod
  if (err.name === 'ZodError') {
    const formattedErrors = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message
    }));
    return sendError(res, 'Dữ liệu gửi lên không đúng định dạng', 422, formattedErrors);
  }

  // Lỗi tùy chỉnh có statusCode
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Đã có lỗi xảy ra trên hệ thống';
  const errors = err.errors || null;

  return sendError(res, message, statusCode, errors);
};

module.exports = errorHandler;

