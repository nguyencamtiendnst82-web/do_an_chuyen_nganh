import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration: bảng appointment_change_requests (đề xuất chuyển nhân viên / dời lịch, chờ khách đồng ý).
 * An toàn khi chạy nhiều lần. Chạy: node scripts/migrate-change-requests.js
 */
export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS appointment_change_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  request_type ENUM('handover','reschedule') NOT NULL COMMENT 'handover: chuyển nhân viên; reschedule: dời lịch',
  proposed_employee_id INT NULL,
  proposed_date DATE NULL,
  proposed_start_time TIME NULL,
  reason VARCHAR(255) NULL,
  status ENUM('pending','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'pending',
  created_by INT NOT NULL COMMENT 'users.id của nhân viên đề xuất',
  expires_at DATETIME NOT NULL,
  responded_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_acr_appointment (appointment_id, status),
  CONSTRAINT fk_acr_appointment FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Đề xuất thay đổi lịch hẹn cần khách đồng ý'`;

const run = async () => {
  await pool.query(CREATE_SQL);
  console.log('✔ Bảng appointment_change_requests sẵn sàng.');
};

if (process.argv[1] && process.argv[1].endsWith('migrate-change-requests.js')) {
  run()
    .catch((err) => {
      console.error('✘ Migration thất bại:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
