import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration xác minh email:
 *  - users.email_verified            (0/1) tài khoản đã chứng minh sở hữu email chưa
 *  - users.email_verify_token_hash   băm SHA-256 của mã xác minh (không lưu mã gốc)
 *  - users.email_verify_expires      hạn của mã xác minh
 * Dữ liệu cũ: nhân viên/admin (do admin tạo) và tài khoản đã gắn Google được coi là ĐÃ xác minh;
 * khách đăng ký bằng mật khẩu thì CHƯA xác minh (phải xác minh mới liên kết được Google).
 * An toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu.
 * Chạy: node scripts/migrate-email-verification.js
 */
const hasColumn = async (name) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
    [name]
  );
  return rows[0].total > 0;
};

const run = async () => {
  const isFirstRun = !(await hasColumn('email_verified'));

  if (isFirstRun) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0
       COMMENT 'Đã xác minh quyền sở hữu email (1) hay chưa (0)'`
    );
    console.log('✔ Đã thêm cột users.email_verified.');
  } else {
    console.log('✔ Cột users.email_verified đã tồn tại.');
  }

  if (!(await hasColumn('email_verify_token_hash'))) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN email_verify_token_hash CHAR(64) NULL
       COMMENT 'SHA-256 của mã xác minh email'`
    );
    console.log('✔ Đã thêm cột users.email_verify_token_hash.');
  }

  if (!(await hasColumn('email_verify_expires'))) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN email_verify_expires DATETIME NULL
       COMMENT 'Hạn dùng của mã xác minh email'`
    );
    console.log('✔ Đã thêm cột users.email_verify_expires.');
  }

  // Chỉ nâng cấp dữ liệu cũ ở LẦN CHẠY ĐẦU, để không tự "xác minh" lại những tài khoản sau này
  if (isFirstRun) {
    const [result] = await pool.query(
      `UPDATE users SET email_verified = 1
       WHERE role_id IN (1, 2) OR google_id IS NOT NULL`
    );
    console.log(`✔ Đã đánh dấu ${result.affectedRows} tài khoản nhân viên/admin/Google là đã xác minh.`);
  }
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
