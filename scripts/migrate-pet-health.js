import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration: thêm pets.allergies và pets.vaccination_notes (an toàn khi chạy nhiều lần).
 * Chạy: node scripts/migrate-pet-health.js
 */
const addColumn = async (name, ddl) => {
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pets' AND COLUMN_NAME = ?`,
    [name]
  );
  if (cols[0].total > 0) {
    console.log(`✔ Cột pets.${name} đã tồn tại.`);
    return;
  }
  await pool.query(`ALTER TABLE pets ADD COLUMN ${ddl}`);
  console.log(`✔ Đã thêm cột pets.${name}.`);
};

const run = async () => {
  await addColumn('allergies', "`allergies` TEXT NULL COMMENT 'Dị ứng (thức ăn, thuốc, sản phẩm tắm...)' AFTER `special_notes`");
  await addColumn('vaccination_notes', "`vaccination_notes` TEXT NULL COMMENT 'Ghi chú tiêm phòng / tẩy giun' AFTER `allergies`");
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
