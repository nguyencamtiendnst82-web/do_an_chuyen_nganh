import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import userRepository from '../repositories/userRepository.js';
import logRepository from '../repositories/logRepository.js';
import { sendMail, appBaseUrl } from '../utils/mailer.js';
import { httpError, fieldError, auditContext } from '../utils/params.js';
import { forgotPasswordSchema, resetPasswordSchema } from '../validations/authSchemas.js';

// Liên kết đặt lại mật khẩu chỉ có hiệu lực 60 phút
const TOKEN_TTL_MINUTES = 60;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const INVALID_LINK_MESSAGE = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';

/**
 * Yêu cầu đặt lại mật khẩu ("Quên mật khẩu").
 * LUÔN trả về thành công như nhau dù email có tồn tại hay không, để người lạ không dò được email nào đã đăng ký.
 * Thư được gửi nền (không chờ) để thời gian phản hồi cũng không lộ email có tồn tại hay không.
 * Tài khoản bị khóa không nhận thư.
 * @returns {Promise<void>} promise của việc gửi thư (nếu có) để test chờ; controller không cần chờ
 */
const requestPasswordReset = async (rawBody, req) => {
  const { email } = forgotPasswordSchema.parse(rawBody);

  const user = await userRepository.findByEmail(email);
  if (!user || user.status !== 'active') return undefined;

  // Mã gốc chỉ nằm trong thư; DB chỉ lưu băm SHA-256. Mã mới thay mã cũ.
  const token = crypto.randomBytes(32).toString('hex');
  await userRepository.setPasswordResetToken(user.id, hashToken(token), TOKEN_TTL_MINUTES);

  await logRepository.insert({
    ...auditContext(req),
    user_id: user.id,
    action: 'REQUEST_PASSWORD_RESET',
    entity_name: 'users',
    entity_id: user.id,
  });

  const link = `${appBaseUrl()}/reset-password?token=${token}`;
  return sendMail({
    to: user.email,
    subject: 'Đặt lại mật khẩu tài khoản Pet Spa',
    text:
      `Xin chào ${user.full_name},\n\n` +
      `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. ` +
      `Bấm vào liên kết sau để đặt mật khẩu mới (có hiệu lực ${TOKEN_TTL_MINUTES} phút):\n${link}\n\n` +
      `Nếu bạn không yêu cầu, hãy bỏ qua thư này, mật khẩu của bạn vẫn giữ nguyên.`,
  }).catch((err) => {
    console.error('❌ [Mail] Không gửi được thư đặt lại mật khẩu:', err.message);
  });
};

/**
 * Đặt mật khẩu mới bằng mã trong liên kết.
 * - Mã sai / hết hạn / đã dùng → 400 (cùng một thông báo)
 * - Mật khẩu mới theo cùng chính sách với đổi mật khẩu: không trùng mật khẩu hiện tại,
 *   không chứa email/SĐT, tối đa 72 byte (giới hạn bcrypt). Vi phạm thì KHÔNG tiêu hao mã.
 * - Thành công: mã bị hủy, mọi đăng nhập cũ (JWT) mất hiệu lực, email được coi là đã xác minh.
 */
const resetPassword = async (rawBody, req) => {
  const parsed = resetPasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Mã sai định dạng → cùng thông báo chung; lỗi ở mật khẩu → để Zod báo theo trường (422)
    const tokenIssue = parsed.error.issues.some((i) => i.path[0] === 'token');
    if (tokenIssue) throw httpError(400, INVALID_LINK_MESSAGE);
    resetPasswordSchema.parse(rawBody); // ném lại lỗi Zod để error handler trả 422
  }
  const { token, new_password: newPassword } = parsed.data;
  const tokenHash = hashToken(token);

  const user = await userRepository.findByPasswordResetToken(tokenHash);
  if (!user) throw httpError(400, INVALID_LINK_MESSAGE);

  if (Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw fieldError('new_password', 'Mật khẩu quá dài (tối đa 72 ký tự).');
  }
  const lowered = newPassword.toLowerCase();
  const emailLocal = (user.email || '').split('@')[0].toLowerCase();
  if ((emailLocal.length >= 4 && lowered.includes(emailLocal)) || (user.phone && lowered.includes(user.phone))) {
    throw fieldError('new_password', 'Mật khẩu không nên chứa email hoặc số điện thoại của bạn.');
  }
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw fieldError('new_password', 'Mật khẩu mới không được trùng với mật khẩu hiện tại.');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const ok = await userRepository.resetPasswordWithToken(tokenHash, newHash);
  if (!ok) throw httpError(400, INVALID_LINK_MESSAGE);

  await logRepository.insert({
    ...auditContext(req),
    user_id: user.id,
    action: 'RESET_PASSWORD',
    entity_name: 'users',
    entity_id: user.id,
  });
};

export { requestPasswordReset, resetPassword };
export default { requestPasswordReset, resetPassword };
