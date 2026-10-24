/**
 * Chuẩn hóa cấu trúc phản hồi API theo quy định GEMINI.md:
 * { success: boolean, message: string, data?: any, errors?: any[] }
 */

const sendSuccess = (res, message = 'Thành công', data = null, statusCode = 200) => {
  const response = {
    success: true,
    message
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

const sendError = (res, message = 'Đã có lỗi xảy ra', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors !== null && errors !== undefined) {
    response.errors = Array.isArray(errors) ? errors : [errors];
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  sendSuccess,
  sendError
};

