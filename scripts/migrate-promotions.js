import 'dotenv/config';
import { pool } from '../src/config/db.js';

/**
 * Migration: khuyến mãi tự động + phê duyệt giảm giá hóa đơn.
 *  - Bảng promotions
 *  - Cột mới của invoices: promotion_id, promotion_name, promotion_discount, manual_discount_reason,
 *    pending_discount, approval_status, approved_by, approved_at
 * An toàn khi chạy nhiều lần, không xóa dữ liệu. Chạy: node scripts/migrate-promotions.js
 */
export const PROMOTIONS_SQL = `
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  discount_type ENUM('percent','amount') NOT NULL COMMENT 'percent: giảm theo %; amount: giảm số tiền cố định',
  discount_value DECIMAL(12,2) NOT NULL,
  service_id INT NULL COMMENT 'NULL = áp dụng mọi dịch vụ',
  min_invoice DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng hóa đơn tối thiểu để được áp dụng',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_promo_active (is_active, start_date, end_date),
  CONSTRAINT fk_promo_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Chương trình khuyến mãi tự động áp dụng khi lập hóa đơn'`;

export const INVOICE_COLUMNS = [
  ['promotion_id', "`promotion_id` INT NULL COMMENT 'Khuyến mãi đã áp dụng' AFTER `discount_amount`"],
  ['promotion_name', "`promotion_name` VARCHAR(150) NULL AFTER `promotion_id`"],
  ['promotion_discount', "`promotion_discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `promotion_name`"],
  ['manual_discount_reason', "`manual_discount_reason` VARCHAR(150) NULL AFTER `promotion_discount`"],
  ['pending_discount', "`pending_discount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Giảm giá thủ công đang chờ admin duyệt' AFTER `manual_discount_reason`"],
  ['approval_status', "`approval_status` ENUM('none','pending','approved','rejected') NOT NULL DEFAULT 'none' AFTER `pending_discount`"],
  ['approved_by', "`approved_by` INT NULL AFTER `approval_status`"],
  ['approved_at', "`approved_at` DATETIME NULL AFTER `approved_by`"],
];

const run = async () => {
  await pool.query(PROMOTIONS_SQL);
  console.log('✔ Bảng promotions sẵn sàng.');
  for (const [name, ddl] of INVOICE_COLUMNS) {
    const [cols] = await pool.query(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices' AND COLUMN_NAME = ?`,
      [name]
    );
    if (cols[0].total > 0) {
      console.log(`✔ invoices.${name} đã tồn tại.`);
    } else {
      await pool.query(`ALTER TABLE invoices ADD COLUMN ${ddl}`);
      console.log(`✔ Đã thêm invoices.${name}.`);
    }
  }
};

if (process.argv[1] && process.argv[1].endsWith('migrate-promotions.js')) {
  run()
    .catch((err) => {
      console.error('✘ Migration thất bại:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
