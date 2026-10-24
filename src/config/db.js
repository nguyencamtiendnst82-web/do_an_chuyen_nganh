const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pet_spa_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Hàm kiểm tra kết nối CSDL
const testDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ [Database] Kết nối MySQL thành công tới database:', process.env.DB_NAME || 'pet_spa_db');
    connection.release();
    return true;
  } catch (error) {
    console.warn('⚠️ [Database] Chưa thể kết nối tới MySQL:', error.message);
    console.warn('👉 Gợi ý: Hãy đảm bảo dịch vụ MySQL đang chạy và đã import file database/schema.sql.');
    return false;
  }
};

module.exports = {
  pool,
  testDbConnection
};

