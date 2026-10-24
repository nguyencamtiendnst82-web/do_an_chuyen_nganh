const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
require('dotenv').config();

const seedDatabase = require('./seed');

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

const initDatabase = async () => {
  try {
    const hasForceFlag = process.argv.includes('--yes') || process.argv.includes('-y');

    if (!hasForceFlag) {
      console.log('====================================================================');
      console.log('⚠️  CẢNH BÁO NGUY HIỂM: KHỞI TẠO LẠI CƠ SỞ DỮ LIỆU PET SPA');
      console.log('Hành động này sẽ XÓA SẠCH toàn bộ cơ sở dữ liệu hiện tại (DROP DATABASE IF EXISTS `pet_spa_db`)');
      console.log('và thiết lập lại toàn bộ cấu trúc từ database/schema.sql.');
      console.log('====================================================================');

      const answer = await askConfirmation('👉 Bạn có chắc chắn muốn tiếp tục? Nhập "y" hoặc "yes" để xác nhận: ');
      if (answer !== 'y' && answer !== 'yes') {
        console.log('🛑 Thao tác khởi tạo đã được hủy bỏ an toàn.');
        process.exit(0);
      }
    }

    console.log('\n⏳ [Init DB] Đang kết nối tới MySQL Server...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    console.log(`📖 [Init DB] Đang đọc tệp cấu trúc: ${schemaPath}`);
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚡ [Init DB] Đang thực thi lệnh DDL tạo CSDL và bảng...');
    await connection.query(schemaSql);
    await connection.end();
    console.log('✅ [Init DB] Đã khởi tạo cấu trúc CSDL thành công!');

    // Chạy seed dữ liệu mẫu sau khi tạo bảng
    console.log('\n🌱 [Init DB] Tiến hành nạp dữ liệu mẫu...');
    await seedDatabase();

    console.log('\n🎉 [Init DB] Toàn bộ quá trình khởi tạo CSDL và dữ liệu mẫu đã hoàn tất!');
  } catch (error) {
    console.error('❌ [Init DB] Khởi tạo CSDL thất bại:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  initDatabase();
}

module.exports = initDatabase;

