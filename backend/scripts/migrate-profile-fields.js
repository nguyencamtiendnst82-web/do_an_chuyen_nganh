import 'dotenv/config';
import { pool } from '../../src/config/db.js';

/**
 * Migration: thêm cột users.gender và users.birth_year (an toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu).
 * Chạy: node backend/scripts/migrate-profile-fields.js
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
  if (await hasColumn('gender')) {
    console.log('✔ Cột users.gender đã tồn tại.');
  } else {
    await pool.query(
      `ALTER TABLE users ADD COLUMN gender ENUM('male','female','other') NULL
       COMMENT 'Giới tính (dùng để xác định cách xưng hô)' AFTER address`
    );
    console.log('✔ Đã thêm cột users.gender.');
  }

  if (await hasColumn('birth_year')) {
    console.log('✔ Cột users.birth_year đã tồn tại.');
  } else {
    await pool.query(
      `ALTER TABLE users ADD COLUMN birth_year SMALLINT NULL
       COMMENT 'Năm sinh (dùng để xác định cách xưng hô)' AFTER gender`
    );
    console.log('✔ Đã thêm cột users.birth_year.');
  }
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
