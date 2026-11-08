import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration "Thông báo":
 *  - Tạo bảng notifications nếu chưa có (đã có thì giữ nguyên dữ liệu)
 *  - Đổi cột type từ ENUM (chỉ 3 loại) sang VARCHAR(50) để thêm loại mới mà không phải sửa DB nữa
 *  - Thêm chỉ mục (user_id, is_read, created_at) cho truy vấn chuông thông báo
 * An toàn khi chạy nhiều lần, KHÔNG xóa dữ liệu. Chạy: node scripts/migrate-notifications.js
 */
const run = async () => {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS notifications (
       notification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
       user_id INT NOT NULL,
       type VARCHAR(50) NOT NULL,
       payload JSON NOT NULL,
       is_read BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     ) ENGINE=InnoDB`
  );
  console.log('✔ Bảng notifications sẵn sàng.');

  const [cols] = await pool.query(
    `SELECT DATA_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'type'`
  );
  if (cols[0] && cols[0].DATA_TYPE === 'enum') {
    await pool.query(`ALTER TABLE notifications MODIFY COLUMN type VARCHAR(50) NOT NULL`);
    console.log('✔ Đã đổi cột type sang VARCHAR(50).');
  } else {
    console.log('✔ Cột type đã là VARCHAR.');
  }

  const [idx] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'idx_notif_user_read'`
  );
  if (idx[0].total === 0) {
    await pool.query(`CREATE INDEX idx_notif_user_read ON notifications (user_id, is_read, created_at)`);
    console.log('✔ Đã tạo chỉ mục idx_notif_user_read.');
  } else {
    console.log('✔ Chỉ mục idx_notif_user_read đã tồn tại.');
  }
};

run()
  .catch((err) => {
    console.error('✘ Migration thất bại:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
