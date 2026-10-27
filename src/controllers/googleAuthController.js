import googleAuthService from '../services/googleAuthService.js';
import { sendSuccess } from '../utils/response.js';

const googleLogin = async (req, res, next) => {
  try {
    const data = await googleAuthService.googleLogin(req.body, req);
    return sendSuccess(res, data.is_new ? 'Tạo tài khoản và đăng nhập bằng Google thành công.' : 'Đăng nhập bằng Google thành công.', data);
  } catch (err) {
    next(err);
  }
};

export { googleLogin };
export default { googleLogin };
