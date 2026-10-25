import 'dotenv/config';
import { pool } from '../../src/config/db.js';

/**
 * Migration: thêm cột users.token_version (an toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu).
 * Chạy: node backend/scripts/migrate-token-version.js
 */
const run = async () => {
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'token_version'`
  );
  if (cols[0].total > 0) {
    console.log('✔ Cột users.token_version đã tồn tại, không cần làm gì.');
  } else {
    await pool.query(
      `ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0
       COMMENT 'Tăng mỗi khi đổi mật khẩu để vô hiệu hóa các JWT cũ' AFTER password_hash`
    );
    console.log('✔ Đã thêm cột users.token_version.');
  }
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
