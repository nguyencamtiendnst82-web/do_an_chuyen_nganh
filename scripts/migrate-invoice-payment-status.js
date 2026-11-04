import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { pool } from '../src/config/db.js';

const EXISTING_STATUS_TYPE = "enum('unpaid','paid','refunded')";
const UPDATED_STATUS_TYPE = "enum('unpaid','partially_paid','paid','refunded')";
const EXPECTED_NULLABLE = 'YES';
const EXPECTED_DEFAULT = 'unpaid';
const EXPECTED_COMMENT = 'Trạng thái thanh toán';

const quoteSqlString = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

const assertExpectedColumnMetadata = (metadata) => {
  const currentType = metadata.COLUMN_TYPE;
  if (
    metadata.IS_NULLABLE !== EXPECTED_NULLABLE ||
    metadata.COLUMN_DEFAULT !== EXPECTED_DEFAULT ||
    metadata.COLUMN_COMMENT !== EXPECTED_COMMENT
  ) {
    throw new Error(
      'Thuộc tính invoices.payment_status không khớp schema dự kiến ' +
      `(IS_NULLABLE=${metadata.IS_NULLABLE}, COLUMN_DEFAULT=${metadata.COLUMN_DEFAULT}, ` +
      `COLUMN_COMMENT=${JSON.stringify(metadata.COLUMN_COMMENT)}); migration đã dừng, không thay đổi database.`
    );
  }
  if (currentType !== EXISTING_STATUS_TYPE && currentType !== UPDATED_STATUS_TYPE) {
    throw new Error(
      `Kiểu invoices.payment_status hiện tại không khớp với schema dự kiến (${metadata.COLUMN_TYPE}); migration đã dừng, không thay đổi database.`
    );
  }
  return currentType;
};

const migrateInvoicePaymentStatus = async (db) => {
  const [rows] = await db.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'invoices'
       AND COLUMN_NAME = 'payment_status'`
  );
  const metadata = rows[0];

  if (!metadata) {
    throw new Error('Không tìm thấy invoices.payment_status; hãy kiểm tra schema trước khi migration.');
  }
  const currentType = assertExpectedColumnMetadata(metadata);
  if (currentType === UPDATED_STATUS_TYPE) {
    return false;
  }

  await db.query(
    `ALTER TABLE invoices
     MODIFY COLUMN payment_status
       ENUM('unpaid', 'partially_paid', 'paid', 'refunded')
       ${metadata.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}
       DEFAULT ${quoteSqlString(metadata.COLUMN_DEFAULT)}
       COMMENT ${quoteSqlString(metadata.COLUMN_COMMENT)}`
  );
  return true;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateInvoicePaymentStatus(pool)
    .then((changed) => {
      console.log(
        changed
          ? '✔ Đã bổ sung trạng thái partially_paid cho invoices.payment_status.'
          : '✔ invoices.payment_status đã có trạng thái partially_paid.'
      );
    })
    .catch((error) => {
      console.error('✘ Migration thất bại:', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

export { migrateInvoicePaymentStatus };
