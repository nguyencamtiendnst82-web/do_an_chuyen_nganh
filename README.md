# Website Quản Lý và Vận Hành Dịch Vụ Spa Thú Cưng (Pet Spa System)

Hệ thống quản lý và vận hành toàn diện cho dịch vụ Spa thú cưng, phục vụ ba đối tượng: **Quản trị viên (Admin)**, **Nhân viên (Staff)** và **Khách hàng (Customer)**.

---

## 🛠️ Công Nghệ Sử Dụng

- **Front-end**: React + Vite (JavaScript), Tailwind CSS (responsive mobile-first), React Router DOM, Axios, Recharts.
- **Back-end**: Node.js + Express.js (kiến trúc MVC: routes -> controllers -> services -> repositories), chuẩn ES Modules (ESM).
- **Cơ sở dữ liệu**: MySQL 8.0+, driver `mysql2/promise` (connection pool, prepared statements `?`).
- **Xác thực & Bảo mật**: JWT (access token, thời hạn `8h`), bcryptjs (cost 10), Google OAuth 2.0, helmet, cors, express-rate-limit, chống DoS payload limit 2MB, chống CSV Injection.
- **Kiểm thử**: Jest 29 + Supertest 7 (`--runInBand`, 30/30 Test Suites passed).

---

## 🔐 Danh Sách Tài Khoản Demo

Mật khẩu mặc định cho **TẤT CẢ** các tài khoản mẫu dưới đây là: **`Password123@`**

| Vai trò (Role) | Họ và tên | Email đăng nhập | Số điện thoại | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | Nguyễn Quản Trị | `admin@petspa.com` | `0901234567` | Toàn quyền quản trị hệ thống, báo cáo, nhật ký, nhân sự |
| **Nhân viên (Staff 1)** | Trần Kỹ Thuật Viên 1 | `staff1@petspa.com` | `0912345678` | Chuyên môn Tắm sấy & Trị liệu da lông |
| **Nhân viên (Staff 2)** | Lê Groomer Chuyên Nghiệp | `staff2@petspa.com` | `0923456789` | Chuyên môn Cắt tỉa tạo kiểu dáng Hàn Quốc |
| **Khách hàng (Customer 1)** | Phạm Khách Hàng | `khachhang1@gmail.com` | `0934567890` | Sở hữu thú cưng: Bông Xù (Poodle), Milo (Golden) |
| **Khách hàng (Customer 2)** | Vũ Thị Sen | `khachhang2@gmail.com` | `0945678901` | Sở hữu thú cưng: Miu Miu (Mèo Anh lông ngắn) |

---

## ⚙️ Cấu Hình Môi Trường (.env)

Tạo file `.env` tại thư mục gốc dự án dựa trên `.env.example`:

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

# SMTP gửi email xác minh tài khoản và đặt lại mật khẩu
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-google-app-password
MAIL_FROM=your-email@gmail.com
```

Với Gmail, hãy bật xác minh 2 bước và tạo **Mật khẩu ứng dụng (App Password)** trong tài khoản Google. Dùng mật khẩu ứng dụng làm `SMTP_PASS`, không dùng mật khẩu đăng nhập Gmail. `MAIL_FROM` có thể để trống để dùng `SMTP_USER`. Không chia sẻ hoặc commit file `.env`.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Cài đặt thư viện Backend & Frontend
Tại thư mục gốc dự án:
```powershell
npm install
cd frontend
npm install
cd ..
```

### 2. Khởi tạo Cơ sở dữ liệu & Nạp dữ liệu Demo
- Khởi tạo cấu trúc bảng từ schema:
```powershell
npm run init-db
```
- Nạp dữ liệu demo hoàn chỉnh (idempotent, có thể chạy lại bất kỳ lúc nào):
```powershell
npm run seed-demo
```

### 3. Chạy Server Backend & Ứng dụng Frontend
- **Khởi động Backend API (Port 5000)**:
```powershell
npm run dev
```
- **Khởi động Frontend Client (Port 5173)**:
Mở một cửa sổ Terminal mới:
```powershell
cd frontend
npm run dev
```
Truy cập hệ thống tại: `http://localhost:5173`

### 4. Đăng ký và xác minh email
1. Mở `http://localhost:5173`, đăng ký tài khoản bằng email bạn có thể truy cập.
2. Mở hộp thư đến (kiểm tra cả thư mục Spam), rồi bấm liên kết xác minh trong email.
3. Khi trang báo **“Xác minh email thành công”**, đóng trang và quay lại Pet Spa. Nếu giao diện có nút **“Tôi đã xác minh”**, bấm nút đó để cập nhật trạng thái.

Trong môi trường chạy cục bộ, liên kết thường dùng `localhost`. Hãy mở email trên chính máy đang chạy ứng dụng; nếu mở trên điện thoại, `localhost` sẽ trỏ về điện thoại chứ không phải máy tính. Muốn xác minh bằng điện thoại, ứng dụng cần có địa chỉ mạng mà điện thoại truy cập được.

### 5. Khắc phục lỗi gửi email qua SMTP

Nếu giao diện báo `self-signed certificate in certificate chain`, Node.js không tin cậy một chứng chỉ trong kết nối SMTP. Không tắt xác minh TLS bằng `NODE_TLS_REJECT_UNAUTHORIZED=0` hoặc `rejectUnauthorized: false`.

Trên Windows với Node.js 24 trở lên, thử cho Node.js dùng kho chứng chỉ đáng tin cậy của Windows. Dừng backend bằng `Ctrl+C`, rồi đặt biến môi trường và khởi động lại backend trong **cùng cửa sổ terminal**:

**Command Prompt (CMD):**
```cmd
set NODE_USE_SYSTEM_CA=1
npm run dev
```

**PowerShell:**
```powershell
$env:NODE_USE_SYSTEM_CA = '1'
npm run dev
```

Thiết lập trên chỉ có hiệu lực trong cửa sổ terminal hiện tại. Nếu cần lưu cho các lần mở terminal mới, chạy `setx NODE_USE_SYSTEM_CA 1` trong CMD, sau đó mở một cửa sổ CMD mới và khởi động backend. Tùy chọn này cho Node.js dùng thêm CA của Windows; việc xác minh chứng chỉ TLS vẫn được bật.

Nếu vẫn lỗi:
- Kiểm tra máy có kết nối được tới SMTP không (kết quả này chỉ kiểm tra cổng, không xác minh chứng chỉ):
  ```cmd
  powershell -NoProfile -Command "Test-NetConnection smtp.gmail.com -Port 587"
  ```
  `TcpTestSucceeded: True` nghĩa là kết nối tới cổng được.
- Thử ngắt VPN hoặc đổi sang mạng khác. Nếu vẫn gặp lỗi, kiểm tra tính năng quét HTTPS/SSL của phần mềm bảo mật; chỉ thử tắt riêng tính năng này trong thời gian ngắn rồi bật lại.
- Nếu Node.js vẫn không tin cậy chứng chỉ, xin CA gốc dạng PEM từ quản trị viên mạng hoặc nhà cung cấp. Không cài chứng chỉ không rõ nguồn gốc.

---

## 🧪 Kiểm Thử Hệ Thống (Automated Testing)

Chạy toàn bộ 30 test suites kiểm thử tích hợp và đơn vị của Backend:
```powershell
npm test
```
*Kết quả: 30 passed, 301 tests passed, 0 failed.*

---

## 📖 Tài Liệu Tham Khảo Kèm Theo

Các tài liệu chi tiết nằm trong thư mục `docs/`:
1. [docs/API.md](docs/API.md): Toàn bộ danh mục 11 nhóm API endpoints, tham số và phân quyền.
2. [docs/KICH_BAN_DEMO.md](docs/KICH_BAN_DEMO.md): Kịch bản thuyết trình demo 10 phút chi tiết theo 3 vai trò (Khách ➔ Nhân viên ➔ Quản trị viên).
3. [docs/BAO_CAO_KIEM_THU.md](docs/BAO_CAO_KIEM_THU.md): Báo cáo kết quả kiểm thử tự động toàn diện.

---

## ⚠️ Những Việc Còn Tồn Đọng & Hạn Chế Đã Biết (Known Limitations)

Nhìn nhận một cách khách quan và trung thực, hệ thống hiện tại còn một số điểm có thể mở rộng tiếp trong tương lai:
1. **Thông báo Realtime**: Hệ thống thông báo hiện tại hoạt động theo cơ chế **polling (30 giây/lần)**. Để nâng cấp tức thời hơn mà không cần polling, có thể tích hợp thêm WebSocket / Socket.io hoặc SSE (Server-Sent Events).
2. **Cổng thanh toán thực tế**: Phân hệ thanh toán trực tuyến hiện tại đang tích hợp mã **VietQR mô phỏng**. Khi đưa vào kinh doanh chính thức, cần đăng ký đối tác thương mại để tích hợp webhook tự động xác nhận tiền về tài khoản (như PayOS, MoMo Business, VNPAY).
3. **Email qua SMTP**: Email xác minh tài khoản và đặt lại mật khẩu cần cấu hình SMTP trong `.env`. Môi trường phát triển chưa cấu hình `SMTP_HOST` sẽ in nội dung thư ra console thay vì gửi email thật.
