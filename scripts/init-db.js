import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { fileURLToPath as __fileURLToPath } from 'node:url';
import { dirname as __dirnameOf } from 'node:path';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import mysql from 'mysql2/promise';

import seedDatabase from './seed.js';
import { assertDatabaseDoesNotExist, applySchemaToNewDatabase } from './dbSafety.js';

const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnameOf(__filename);
const projectRoot = path.resolve(__dirname, '..');

const askConfirmation = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

const initDatabase = async ({ confirm = askConfirmation } = {}) => {
  let connection;
  let databaseCreatedThisRun = false;
  try {
    const hasForceFlag = process.argv.includes('--yes') || process.argv.includes('-y');

    if (!hasForceFlag) {
      console.log('====================================================================');
      console.log('⚠️  Khởi tạo cơ sở dữ liệu Pet Spa chỉ khi database chưa tồn tại.');
      console.log('Script sẽ từ chối nếu database đã có; không xóa hoặc sửa dữ liệu hiện tại.');
      console.log('====================================================================');

      const answer = await confirm('👉 Tiếp tục tạo database mới? Nhập "y" hoặc "yes" để xác nhận: ');
      if (answer !== 'y' && answer !== 'yes') {
        console.log('🛑 Đã hủy khởi tạo; không có thay đổi nào được thực hiện.');
        return false;
      }
    }

    console.log('\n⏳ [Init DB] Đang kết nối tới MySQL Server...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    const databaseName = process.env.DB_NAME || 'pet_spa_db';
    await assertDatabaseDoesNotExist(connection, databaseName);

    const schemaPath = path.join(projectRoot, 'database', 'schema.sql');
    console.log(`📖 [Init DB] Đang đọc tệp cấu trúc: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚡ [Init DB] Đang tạo database và cấu trúc bảng...');
    await applySchemaToNewDatabase(connection, schemaSql, databaseName)
      .catch((error) => {
        databaseCreatedThisRun = error.databaseCreated === true;
        throw error;
      });
    databaseCreatedThisRun = true;
    await connection.end();
    connection = null;
    console.log('✅ [Init DB] Đã khởi tạo cấu trúc CSDL thành công!');

    // Chỉ thêm dữ liệu mẫu sau khi tạo database mới, rỗng.
    console.log('\n🌱 [Init DB] Tiến hành nạp dữ liệu mẫu...');
    await seedDatabase();

    console.log('\n🎉 [Init DB] Toàn bộ quá trình khởi tạo CSDL và dữ liệu mẫu đã hoàn tất!');
    return true;
  } catch (error) {
    console.error('❌ [Init DB] Khởi tạo CSDL thất bại:', error.message);
    if (databaseCreatedThisRun || error.databaseCreated === true) {
      const failedDatabaseName = error.databaseName || process.env.DB_NAME || 'pet_spa_db';
      console.error(
        `⚠️ Database "${failedDatabaseName}" được tạo trong lần chạy hiện tại và có thể chưa hoàn chỉnh. Database được giữ nguyên; không tự động xóa hoặc sửa. Hãy giữ database này để kiểm tra, đặt DB_NAME thành tên database mới chưa tồn tại rồi chạy lại init để phục hồi an toàn.`
      );
    }
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  initDatabase().catch(() => {
    process.exitCode = 1;
  });
}

export default initDatabase;
