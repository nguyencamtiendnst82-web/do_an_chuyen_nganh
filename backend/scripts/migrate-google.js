import 'dotenv/config';
import { pool } from '../../src/config/db.js';

/**
 * Migration cho đăng nhập Google:
 *  - users.google_id (mã tài khoản Google, duy nhất)
 *  - users.phone cho phép NULL (người đăng nhập bằng Google chưa có số điện thoại)
 * An toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu.
 * Chạy: node backend/scripts/migrate-google.js
 */
const columnInfo = async (name) => {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
    [name]
  );
  return rows[0] || null;
};

const run = async () => {
  if (await columnInfo('google_id')) {
    console.log('✔ Cột users.google_id đã tồn tại.');
  } else {
    await pool.query(
      `ALTER TABLE users ADD COLUMN google_id VARCHAR(64) NULL UNIQUE COMMENT 'Mã tài khoản Google (sub)'`
    );
    console.log('✔ Đã thêm cột users.google_id.');
  }

  const phone = await columnInfo('phone');
  if (!phone) throw new Error('Không tìm thấy cột users.phone.');
  if (phone.IS_NULLABLE === 'YES') {
    console.log('✔ Cột users.phone đã cho phép NULL.');
  } else {
    // Giữ nguyên kiểu dữ liệu hiện có (VD varchar(15)); chỉ đổi sang cho phép NULL
    await pool.query(`ALTER TABLE users MODIFY COLUMN phone ${phone.COLUMN_TYPE} NULL`);
    console.log('✔ Đã cho phép users.phone nhận NULL.');
  }
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
