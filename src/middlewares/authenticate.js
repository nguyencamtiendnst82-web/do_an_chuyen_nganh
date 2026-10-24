const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { sendError } = require('../utils/response');

/**
 * Middleware xác thực JWT
 * - Xác minh token từ header Authorization: Bearer <token>
 * - Nạp thông tin user từ DB để phát hiện tài khoản bị khóa SAU khi đăng nhập
 * - Gắn req.user = { id, full_name, email, phone, role_name, status }
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Token xác thực không hợp lệ.', 401);
    }

    // Xác minh chữ ký và hạn token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 401);
      }
      return sendError(res, 'Token xác thực không hợp lệ hoặc đã bị giả mạo.', 401);
    }

    // Nạp user từ DB để bắt trạng thái bị khóa sau khi phát token
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return sendError(res, 'Tài khoản không tồn tại hoặc đã bị xóa.', 401);
    }

    // Từ chối tài khoản không ở trạng thái active
    if (user.status === 'locked') {
      return sendError(res, 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.', 403);
    }
    if (user.status === 'inactive') {
      return sendError(res, 'Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ quản trị viên.', 403);
    }

    // Gắn thông tin user vào request (không bao gồm password_hash)
    req.user = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role_name: user.role_name,
      status: user.status,
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
