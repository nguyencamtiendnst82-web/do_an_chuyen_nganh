/**
 * Gửi thư điện tử (dùng cho xác minh email).
 *
 * Cấu hình qua .env:
 *   SMTP_HOST, SMTP_PORT (mặc định 587), SMTP_SECURE (true nếu cổng 465),
 *   SMTP_USER, SMTP_PASS, MAIL_FROM (mặc định = SMTP_USER)
 *
 * - Chưa cấu hình SMTP_HOST:
 *     + môi trường phát triển → IN nội dung thư (kèm link xác minh) ra console để copy, không gửi thật
 *     + production → báo lỗi (không im lặng bỏ qua)
 * - Thư viện nodemailer được nạp khi cần, nên chưa cài thì các chức năng khác vẫn chạy.
 * - Khi chạy Jest: không gửi, trừ khi test gắn bộ giả lập bằng setMailerForTest.
 */
let override = null;
let transporter = null;

/** Chỉ dùng trong test để bắt nội dung thư (không bao giờ gửi mạng) */
const setMailerForTest = (fn) => {
  if (process.env.NODE_ENV !== 'test') throw new Error('Chỉ dùng được khi chạy test.');
  override = fn;
};

const sendMail = async ({ to, subject, text }) => {
  if (override) return override({ to, subject, text });
  if (process.env.NODE_ENV === 'test') return undefined;

  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Chưa cấu hình SMTP_HOST nên không gửi được email.');
    }
    console.log(`📧 [Mail - chưa cấu hình SMTP, chỉ in ra console]\n   Tới: ${to}\n   Tiêu đề: ${subject}\n${text}\n`);
    return undefined;
  }

  let nodemailer;
  try {
    ({ default: nodemailer } = await import('nodemailer'));
  } catch {
    throw new Error('Máy chủ chưa cài thư viện nodemailer (npm install nodemailer).');
  }

  transporter ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
  return undefined;
};

/** Địa chỉ gốc để dựng link trong thư: PUBLIC_BASE_URL, hoặc địa chỉ frontend (đi qua proxy /api) */
const appBaseUrl = () =>
  (process.env.PUBLIC_BASE_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');

export { sendMail, setMailerForTest, appBaseUrl };
export default { sendMail, setMailerForTest, appBaseUrl };
