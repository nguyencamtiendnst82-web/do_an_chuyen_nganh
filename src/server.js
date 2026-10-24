const app = require('./app');
const { testDbConnection, pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

// Khởi động server
const startServer = async () => {
  // Kiểm tra kết nối CSDL khi khởi động
  await testDbConnection();

  const server = app.listen(PORT, () => {
    console.log(`🚀 [Server] Pet Spa API Server đang chạy tại http://localhost:${PORT}`);
    console.log(`📌 [Health Check] Kiểm tra trạng thái hệ thống: http://localhost:${PORT}/api/health`);
  });

  // Xử lý tắt server an toàn (Graceful Shutdown)
  const shutdown = async () => {
    console.log('\n🛑 [Server] Đang tiến hành đóng server và giải phóng kết nối...');
    server.close(async () => {
      try {
        await pool.end();
        console.log('✅ [Database] Đã đóng toàn bộ kết nối CSDL.');
      } catch (err) {
        console.error('❌ [Database] Lỗi khi đóng kết nối CSDL:', err.message);
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

startServer();

