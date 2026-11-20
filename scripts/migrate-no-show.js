import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration: thêm trạng thái 'no_show' (khách không đến) cho appointments.status.
 * An toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu. Chạy: node scripts/migrate-no-show.js
 */
const run = async () => {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'status'`
  );
  if (rows[0]?.COLUMN_TYPE?.includes('no_show')) {
    console.log('✔ appointments.status đã có no_show, không cần làm gì.');
    return;
  }
  await pool.query(
    `ALTER TABLE appointments MODIFY COLUMN status
     ENUM('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show')
     DEFAULT 'pending' COMMENT 'Quy trình trạng thái lịch hẹn'`
  );
  console.log('✔ Đã thêm trạng thái no_show.');
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
