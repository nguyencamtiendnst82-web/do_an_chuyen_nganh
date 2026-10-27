import { httpError } from './params.js';

/**
 * Xác minh "credential" (ID token) do Google trả về cho nút "Đăng nhập bằng Google".
 * - Kiểm tra chữ ký, thời hạn và audience = GOOGLE_CLIENT_ID của ứng dụng này.
 * - Thư viện google-auth-library được nạp khi cần, nên chưa cài thì các chức năng khác vẫn chạy.
 * Trả về { sub, email, email_verified, name }.
 */
let override = null;
let client = null;

/** Chỉ dùng trong test để giả lập Google (không bao giờ gọi mạng) */
const setGoogleVerifierForTest = (fn) => {
  if (process.env.NODE_ENV !== 'test') throw new Error('Chỉ dùng được khi chạy test.');
  override = fn;
};

const verifyGoogleCredential = async (credential) => {
  if (override) return override(credential);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw httpError(503, 'Đăng nhập bằng Google chưa được cấu hình trên máy chủ.');

  let OAuth2Client;
  try {
    ({ OAuth2Client } = await import('google-auth-library'));
  } catch {
    throw httpError(503, 'Máy chủ chưa cài thư viện google-auth-library.');
  }
  client ??= new OAuth2Client(clientId);

  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
    const p = ticket.getPayload();
    return { sub: p.sub, email: p.email, email_verified: p.email_verified, name: p.name };
  } catch {
    throw httpError(401, 'Đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
  }
};

export { verifyGoogleCredential, setGoogleVerifierForTest };
export default { verifyGoogleCredential, setGoogleVerifierForTest };
