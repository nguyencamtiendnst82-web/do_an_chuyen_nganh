import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration "Quên mật khẩu":
 *  - users.password_reset_token_hash  băm SHA-256 của mã đặt lại mật khẩu (không lưu mã gốc)
 *  - users.password_reset_expires     hạn của mã
 * An toàn khi chạy nhiều lần, KHÔNG xóa và KHÔNG sửa dữ liệu hiện có.
 * Chạy: node scripts/migrate-password-reset.js
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
  if (!(await hasColumn('password_reset_token_hash'))) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN password_reset_token_hash CHAR(64) NULL
       COMMENT 'SHA-256 của mã đặt lại mật khẩu'`
    );
    console.log('✔ Đã thêm cột users.password_reset_token_hash.');
  } else {
    console.log('✔ Cột users.password_reset_token_hash đã tồn tại.');
  }

  if (!(await hasColumn('password_reset_expires'))) {
    await pool.query(
      `ALTER TABLE users ADD COLUMN password_reset_expires DATETIME NULL
       COMMENT 'Hạn dùng của mã đặt lại mật khẩu'`
    );
    console.log('✔ Đã thêm cột users.password_reset_expires.');
  } else {
    console.log('✔ Cột users.password_reset_expires đã tồn tại.');
  }
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
