/**
 * Tiện ích dùng chung cho controller/service mới
 */

/** Tạo lỗi HTTP có statusCode (errorHandler sẽ trả đúng mã) */
const httpError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

/** Lỗi 422 gắn theo trường để frontend hiện dưới đúng ô nhập */
const fieldError = (field, message) => {
  const err = new Error('Dữ liệu gửi lên không đúng định dạng');
  err.statusCode = 422;
  err.errors = [{ field, message }];
  return err;
};

/** Đọc ID trong URL, từ chối giá trị không phải số nguyên dương */
const parseId = (raw, label = 'ID') => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${label} không hợp lệ.`);
  return n;
};

/** Thông tin người thực hiện + nguồn gốc request, dùng để ghi system_logs */
const auditContext = (req) => ({
  user_id: req.user?.id ?? null,
  ip_address: req.ip || null,
  user_agent: req.headers?.['user-agent']?.slice(0, 255) || null,
});

export { httpError, fieldError, parseId, auditContext };
export default { httpError, fieldError, parseId, auditContext };
