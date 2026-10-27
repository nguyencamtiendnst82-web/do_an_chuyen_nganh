import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import userRepository from '../repositories/userRepository.js';
import googleUserRepository from '../repositories/googleUserRepository.js';
import logRepository from '../repositories/logRepository.js';
import tokenVersionRepository from '../repositories/tokenVersionRepository.js';
import { verifyGoogleCredential } from '../utils/googleVerifier.js';
import { httpError } from '../utils/params.js';

const CUSTOMER_ROLE_ID = 3;

const bodySchema = z.object({
  credential: z.string({ required_error: 'Thiếu thông tin đăng nhập Google', invalid_type_error: 'Thông tin đăng nhập Google không hợp lệ' })
    .min(20, 'Thông tin đăng nhập Google không hợp lệ')
    .max(4096, 'Thông tin đăng nhập Google không hợp lệ'),
});

const signToken = (userId, tokenVersion = 0) =>
  jwt.sign({ id: userId, tv: tokenVersion }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

const safeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  phone: user.phone ?? null,
  address: user.address,
  gender: user.gender ?? null,
  birth_year: user.birth_year ?? null,
  avatar_url: user.avatar_url,
  status: user.status,
  role_name: user.role_name,
  role_display_name: user.role_display_name,
  created_at: user.created_at,
});

/**
 * Đăng nhập bằng Google:
 *  1. Xác minh credential với Google (chữ ký, hạn, audience) và bắt buộc email đã được Google xác minh.
 *  2. Đã có tài khoản gắn mã Google này → đăng nhập.
 *  3. Chưa gắn nhưng đã có tài khoản cùng email (khách cũ, nhân viên, admin do admin tạo) → gắn Google vào rồi đăng nhập.
 *  4. Chưa có gì → tạo tài khoản KHÁCH HÀNG mới (vai trò do server gán, không nhận từ client).
 * Tài khoản bị khóa / ngừng hoạt động vẫn bị từ chối như đăng nhập thường.
 */
const googleLogin = async (body, req) => {
  const { credential } = bodySchema.parse(body);
  const profile = await verifyGoogleCredential(credential);

  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    throw httpError(401, 'Email Google chưa được xác minh nên không thể đăng nhập.');
  }
  const email = String(profile.email).trim().toLowerCase();

  let isNew = false;
  let user = null;

  const linkedId = await googleUserRepository.findIdByGoogleId(profile.sub);
  if (linkedId) {
    user = await userRepository.findById(linkedId);
  } else {
    user = await userRepository.findByEmail(email);
    if (user) {
      const existingGoogleId = await googleUserRepository.getGoogleId(user.id);
      if (existingGoogleId && existingGoogleId !== profile.sub) {
        throw httpError(403, 'Email này đã được liên kết với một tài khoản Google khác.');
      }
      await googleUserRepository.link(user.id, profile.sub);
    } else {
      const fullName = (profile.name || email.split('@')[0]).trim().slice(0, 100);
      const randomPassword = crypto.randomBytes(32).toString('hex'); // không ai biết → chỉ vào được bằng Google
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      let newId;
      try {
        newId = await googleUserRepository.createCustomer({
          roleId: CUSTOMER_ROLE_ID, fullName, email, passwordHash, googleId: profile.sub,
        });
        isNew = true;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY') throw err;
        newId = (await userRepository.findByEmail(email))?.id; // hai lần bấm cùng lúc
      }
      user = await userRepository.findById(newId);
    }
  }

  if (!user) throw httpError(401, 'Không thể đăng nhập bằng Google. Vui lòng thử lại.');
  if (user.status === 'locked') throw httpError(403, 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
  if (user.status === 'inactive') throw httpError(403, 'Tài khoản của bạn hiện không hoạt động. Vui lòng liên hệ quản trị viên.');

  const token = signToken(user.id, await tokenVersionRepository.get(user.id));

  await logRepository.insert({
    user_id: user.id,
    ip_address: req.ip || null,
    user_agent: req.headers?.['user-agent']?.slice(0, 255) || null,
    action: isNew ? 'USER_GOOGLE_REGISTER' : 'USER_GOOGLE_LOGIN',
    entity_name: 'users',
    entity_id: user.id,
    new_values: { email, via: 'google' },
  });

  return { token, user: safeUser(user), is_new: isNew };
};

export { googleLogin };
export default { googleLogin };
