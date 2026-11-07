// scripts/migrate.js
// Chạy các file migration SQL trong thư mục database/migrations
// Dùng pool từ src/config/db.js (ESM) và thực thi từng file tuần tự.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.resolve(__dirname, '..', 'database', 'migrations');

async function runMigrations() {
  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    if (!files.length) {
      console.log('✅ Không có migration nào để chạy.');
      return;
    }
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`🚀 Đang chạy migration: ${file}`);
      // MySQL driver cho phép chạy nhiều câu lệnh nếu chúng được ngăn cách bằng ';'
      // pool.execute chỉ chấp nhận một statement, vì vậy dùng connection.query.
      const connection = await pool.getConnection();
      try {
        await connection.query(sql);
        console.log(`✅ ${file} hoàn thành`);
      } finally {
        connection.release();
      }
    }
    console.log('🎉 Tất cả migration đã được thực thi.');
  } catch (err) {
    console.error('❌ Lỗi khi chạy migration:', err);
    process.exit(1);
  } finally {
    // Đóng pool để script kết thúc
    await pool.end();
  }
}

runMigrations();

