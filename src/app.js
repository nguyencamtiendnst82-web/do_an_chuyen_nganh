import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

import routes from './routes/index.js';
import errorHandler from './middlewares/errorHandler.js';
import { sendError } from './utils/response.js';

const app = express();

// Bảo mật HTTP Headers
app.use(helmet());

// Cấu hình CORS - Giới hạn origin theo GEMINI.md
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Cho phép gọi trực tiếp từ tools (Postman, curl không gửi origin) hoặc từ client frontend
    if (!origin || origin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Nguồn truy cập không được phép'));
    }
  },
  credentials: true
}));

// Ghi log HTTP requests (ở môi trường phát triển hoặc test)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Parse dữ liệu gửi lên
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gắn toàn bộ router chính của API
app.use('/api', routes);

// Xử lý route không tồn tại (404)
app.use((req, res) => {
  return sendError(res, `Đường dẫn [${req.method}] ${req.originalUrl} không tồn tại`, 404);
});

// Middleware xử lý lỗi tập trung
app.use(errorHandler);

export default app;

