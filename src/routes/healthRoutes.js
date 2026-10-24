const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

router.get('/health', async (req, res) => {
  try {
    // Kiểm tra kết nối tới MySQL
    const [rows] = await pool.query('SELECT 1 + 1 AS health_check');
    
    return sendSuccess(res, 'Hệ thống Pet Spa API đang hoạt động bình thường', {
      status: 'healthy',
      database: 'connected',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return sendError(
      res,
      'Không thể kết nối đến cơ sở dữ liệu MySQL',
      503,
      [error.message]
    );
  }
});

module.exports = router;

