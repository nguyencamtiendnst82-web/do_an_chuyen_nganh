# Website Quản Lý và Vận Hành Dịch Vụ Spa Thú Cưng (Pet Spa System)

Hệ thống quản lý và vận hành toàn diện cho dịch vụ Spa thú cưng, phục vụ ba đối tượng: **Quản trị viên (Admin)**, **Nhân viên (Staff)** và **Khách hàng (Customer)**.

---

## 🛠️ Công Nghệ Sử Dụng

- **Front-end**: React + Vite (JavaScript), Tailwind CSS (responsive mobile-first), React Router DOM, Axios.
- **Back-end**: Node.js + Express.js (kiến trúc MVC: routes -> controllers -> services -> repositories), chuẩn CommonJS.
- **Cơ sở dữ liệu**: MySQL 8.0+, driver `mysql2/promise` (connection pool, prepared statements `?`).
- **Xác thực & Bảo mật**: JWT (access token, thời hạn `8h`), bcrypt (cost 10), helmet, cors, express-rate-limit.
- **Kiểm thử**: Jest + Supertest.

---

## 🔐 Danh Sách Tài Khoản Demo

Mật khẩu mặc định cho **TẤT CẢ** các tài khoản mẫu dưới đây là: **`Password123@`**

| Vai trò (Role) | Họ và tên | Email đăng nhập | Số điện thoại | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | Nguyễn Quản Trị | `admin@petspa.com` | `0901234567` | Toàn quyền quản trị hệ thống, báo cáo, nhân sự |
| **Nhân viên (Staff 1)** | Trần Kỹ Thuật Viên 1 | `staff1@petspa.com` | `0912345678` | Chuyên môn Tắm sấy & Trị liệu da lông |
| **Nhân viên (Staff 2)** | Lê Groomer Chuyên Nghiệp | `staff2@petspa.com` | `0923456789` | Chuyên môn Cắt tỉa tạo kiểu dáng Hàn Quốc |
| **Khách hàng (Customer 1)** | Phạm Khách Hàng | `khachhang1@gmail.com` | `0934567890` | Sở hữu thú cưng: Bông Xù (Poodle), Milo (Golden) |
| **Khách hàng (Customer 2)** | Vũ Thị Sen | `khachhang2@gmail.com` | `0945678901` | Sở hữu thú cưng: Miu Miu (Mèo Anh lông ngắn) |

---

## ⚙️ Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc dựa trên `.env.example`:

```env
PORT=5000
NODE_ENV=development

# Cấu hình kết nối MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pet_spa_db

# JWT Bí mật dùng để ký và xác thực token (thời hạn 8h)
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=8h

# CORS Allowed Origin
CLIENT_URL=http://localhost:5173
```

> [!IMPORTANT]
> Thời hạn của token JWT được chuẩn hóa thống nhất là **`JWT_EXPIRES_IN=8h`**.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Cài đặt thư viện Backend
Tại thư mục gốc dự án:
```powershell
npm install
```

### 2. Khởi tạo Cơ sở dữ liệu & Dữ liệu mẫu (Seed Data)
Hệ thống cung cấp lệnh tự động đọc DDL `database/schema.sql` và chạy script sinh dữ liệu `backend/scripts/seed.js` (tự động băm mật khẩu `Password123@` và sinh ca làm 30 ngày):

```powershell
npm run init-db
```
*(Lệnh sẽ hiển thị cảnh báo xác nhận `y/N` trước khi thực thi xóa và tạo lại CSDL)*.

Nếu chỉ muốn nạp lại dữ liệu mẫu mà không tạo lại bảng:
```powershell
npm run seed
```

### 3. Chạy Server Backend
```powershell
# Chế độ phát triển (tự động reload với nodemon):
npm run dev

# Chế độ thông thường:
npm start
```
- API Server lắng nghe tại: `http://localhost:5000`
- Kiểm tra trạng thái hệ thống: `http://localhost:5000/api/health`

### 4. Chạy Kiểm Thử Backend (Jest + Supertest)
```powershell
npm test
```

### 5. Khởi Chạy Frontend (React + Vite)
Di chuyển vào thư mục `frontend`:
```powershell
cd frontend
npm install
npm run dev
```
Giao diện ứng dụng chạy tại: `http://localhost:5173`

---

## 📁 Cấu Trúc Mã Nguồn Backend

```
├── database/
│   ├── schema.sql              # Cấu trúc CSDL chuẩn 13 bảng
│   └── seed.sql                # Dữ liệu danh mục tĩnh
├── backend/
│   └── scripts/
│       ├── seed.js             # Script sinh dữ liệu mẫu động (bcrypt, phân ca 30 ngày)
│       └── init-db.js          # Script CLI khởi tạo CSDL an toàn có xác nhận
├── src/
│   ├── app.js                  # Cấu hình Express, helmet, cors, morgan, router, errorHandler
│   ├── server.js               # Khởi động server, kiểm tra kết nối DB, lắng nghe PORT
│   ├── config/
│   │   └── db.js               # MySQL connection pool (mysql2/promise)
│   ├── routes/
│   │   ├── index.js            # Gắn các route /api
│   │   └── healthRoutes.js     # GET /api/health
│   ├── controllers/            # Tầng điều khiển (phân hệ tiếp theo)
│   ├── services/               # Tầng xử lý nghiệp vụ
│   ├── repositories/           # Tầng truy vấn CSDL
│   ├── middlewares/
│   │   └── errorHandler.js     # Bắt lỗi tập trung chuẩn { success, message, errors }
│   └── utils/
│       └── response.js         # Helper chuẩn hóa phản hồi API
├── tests/
│   └── health.test.js          # Kiểm thử tự động API health check
└── frontend/                   # Ứng dụng client React + Vite + Tailwind CSS
```

