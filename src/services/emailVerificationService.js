import crypto from 'node:crypto';
import userRepository from '../repositories/userRepository.js';
import logRepository from '../repositories/logRepository.js';
import { sendMail, appBaseUrl } from '../utils/mailer.js';
import { httpError, auditContext } from '../utils/params.js';

// Mã xác minh có hiệu lực 24 giờ
const TOKEN_TTL_HOURS = 24;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Tạo mã xác minh mới (thay mã cũ) rồi gửi thư chứa link.
 * Mã gốc chỉ nằm trong thư; DB chỉ lưu băm SHA-256 nên lộ DB cũng không dùng được mã.
 * @returns {Promise<boolean>} false nếu email đã xác minh (không gửi)
 */
const sendVerificationEmail = async (user) => {
  if (user.email_verified) return false;

  const token = crypto.randomBytes(32).toString('hex');
  await userRepository.setEmailVerifyToken(user.id, hashToken(token), TOKEN_TTL_HOURS);

  const link = `${appBaseUrl()}/api/auth/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Xác minh email tài khoản Pet Spa',
    text:
      `Xin chào ${user.full_name},\n\n` +
      `Vui lòng bấm vào liên kết sau để xác minh email của bạn (có hiệu lực ${TOKEN_TTL_HOURS} giờ):\n${link}\n\n` +
      `Nếu bạn không đăng ký tài khoản Pet Spa, hãy bỏ qua thư này.`,
  });
  return true;
};

/** Gửi thư nhưng không để lỗi gửi mail làm hỏng thao tác chính (vd. đăng ký vẫn thành công) */
const trySendVerificationEmail = async (user) => {
  try {
    return await sendVerificationEmail(user);
  } catch (err) {
    console.error('❌ [Mail] Không gửi được thư xác minh email:', err.message);
    return false;
  }
};

/**
 * Xác minh email bằng mã trong link. Sai / hết hạn / đã dùng → 400 (cùng một thông báo, không phân biệt).
 */
const verifyEmail = async (token, req) => {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw httpError(400, 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
  }
  const userId = await userRepository.consumeEmailVerifyToken(hashToken(token));
  if (!userId) {
    throw httpError(400, 'Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
  }
  await logRepository.insert({
    ...auditContext(req),
    user_id: userId,
    action: 'VERIFY_EMAIL',
    entity_name: 'users',
    entity_id: userId,
  });
};

/** Người dùng đang đăng nhập yêu cầu gửi lại thư xác minh */
const resendVerification = async (actor, req) => {
  const user = await userRepository.findById(actor.id);
  if (!user) throw httpError(404, 'Không tìm thấy tài khoản.');
  if (user.email_verified) return { already_verified: true };

  await sendVerificationEmail(user);
  await logRepository.insert({
    ...auditContext(req),
    action: 'RESEND_EMAIL_VERIFICATION',
    entity_name: 'users',
    entity_id: user.id,
  });
  return { already_verified: false };
};

export { sendVerificationEmail, trySendVerificationEmail, verifyEmail, resendVerification };
export default { sendVerificationEmail, trySendVerificationEmail, verifyEmail, resendVerification };
