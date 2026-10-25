import express from 'express';
const router = express.Router();
import { pool } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/response.js';

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

export default router;

