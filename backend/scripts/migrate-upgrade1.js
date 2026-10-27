import 'dotenv/config';
import { pool } from '../../src/config/db.js';

/**
 * Migration cho "Nâng cấp 1": thêm cột pets.birth_month (tháng sinh).
 * An toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu.
 * Với thú cưng cũ chỉ có age_months, tự suy ra tháng sinh gần đúng.
 * Chạy: node backend/scripts/migrate-upgrade1.js
 */
const hasColumn = async (table, name) => {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, name]
  );
  return rows[0].total > 0;
};

const run = async () => {
  if (await hasColumn('pets', 'birth_month')) {
    console.log('✔ Cột pets.birth_month đã tồn tại.');
  } else {
    await pool.query(
      `ALTER TABLE pets ADD COLUMN birth_month DATE NULL
       COMMENT 'Tháng sinh (lưu ngày 01 của tháng); tuổi được tự tính từ cột này' AFTER age_months`
    );
    console.log('✔ Đã thêm cột pets.birth_month.');
  }

  const [result] = await pool.query(
    `UPDATE pets
     SET birth_month = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL age_months MONTH), '%Y-%m-01')
     WHERE age_months IS NOT NULL AND birth_month IS NULL`
  );
  console.log(`✔ Đã suy ra tháng sinh cho ${result.affectedRows} thú cưng cũ (từ số tháng tuổi).`);
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
