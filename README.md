# Pet Spa System

Website quản lý và vận hành dịch vụ spa thú cưng, phục vụ ba vai trò: **Admin**, **Staff** (nhân viên) và **Customer** (khách hàng).

## Tính năng chính

- Đăng ký, đăng nhập, đăng nhập Google, quản lý hồ sơ và mật khẩu.
- Quản lý hồ sơ thú cưng và danh mục dịch vụ.
- Tra cứu khung giờ, đặt lịch, xác nhận, đổi lịch, hủy lịch và phân công nhân viên.
- Quản lý ca làm và lịch phân ca.
- Ghi nhật ký chăm sóc, ảnh trước/sau và sự cố.
- Lập hóa đơn, ghi nhận thanh toán và theo dõi trạng thái.
- Ghi nhật ký thao tác hệ thống.

## Công nghệ

| Phần | Công nghệ |
| :--- | :--- |
| Backend | Node.js, Express 4, **ES modules** (`"type": "module"`), MySQL, `mysql2/promise` |
| Frontend | React, Vite, Tailwind CSS, React Router, Axios |
| Xác thực và bảo mật | JWT, bcryptjs, Google authentication, helmet, cors, express-rate-limit, Zod |
| Kiểm thử | Jest, Supertest |

Yêu cầu: Node.js 18 trở lên, MySQL 8+ (schema có ghi chú hỗ trợ MariaDB 10.5+). MySQL phải đang chạy trước khi khởi tạo cơ sở dữ liệu.

## Chạy trên terminal

Mọi lệnh dưới đây chạy trong terminal, ví dụ terminal tích hợp của VS Code.

1. Mở thư mục dự án bằng VS Code (`File` → `Open Folder`).
2. Mở terminal: nhấn `` Ctrl+` `` hoặc menu `Terminal` → `New Terminal`. Dòng nhắc lệnh phải hiện đường dẫn thư mục dự án.
3. Chọn loại terminal bằng mũi tên cạnh dấu `+` ở panel Terminal: **Command Prompt**, **PowerShell** hoặc **Git Bash** đều dùng được. Các lệnh `npm`, `node`, `git`, `cd` giống nhau ở cả ba.
4. Backend và frontend chạy ở **hai terminal riêng**: bấm dấu `+` để mở terminal thứ hai. Dừng một tiến trình bằng `Ctrl+C`.

Lệnh sao chép file khác nhau theo hệ điều hành (dùng ở bước 2 của mục Cài đặt):

| Hệ điều hành | Lệnh sao chép file |
| :--- | :--- |
| Windows (cmd hoặc PowerShell) | `copy nguon dich` |
| macOS, Linux, Git Bash | `cp nguon dich` |

> Trên Windows, nếu PowerShell báo không cho chạy `npm.ps1`, dùng Command Prompt, hoặc gõ `npm.cmd run ...`, hoặc chạy một lần `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## Cài đặt

### 1. Cài thư viện

```bash
npm install
cd frontend
npm install
cd ..
```

### 2. Cấu hình môi trường

Tạo hai file cấu hình từ file mẫu.

Windows (cmd hoặc PowerShell):

```bash
copy .env.example .env
copy frontend\.env.example frontend\.env
```

macOS, Linux, Git Bash:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
```

Sau đó mở `.env` ở thư mục gốc và điền giá trị. Các biến chính:

```env
PORT=5000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=pet_spa_db

JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=8h

CLIENT_URL=http://localhost:5173

# Tùy chọn (.env.example có sẵn Client ID demo)
GOOGLE_CLIENT_ID=
APPOINTMENT_BUFFER_MINUTES=15
```

- `DB_PASSWORD`: điền mật khẩu MySQL của bạn.
- `JWT_SECRET`: bắt buộc đổi sang chuỗi bí mật riêng, nhất là khi triển khai thật.
- `GOOGLE_CLIENT_ID`: nếu để trống thì chỉ đăng nhập Google không hoạt động (server trả lỗi 503 cho chức năng này), các chức năng khác vẫn chạy bình thường. Xem mục "Đăng nhập Google".
- `APPOINTMENT_BUFFER_MINUTES`: thời gian đệm (phút) giữa hai lượt phục vụ liên tiếp của cùng một nhân viên; mặc định 15 nếu không khai báo.
- `frontend/.env` chứa `VITE_GOOGLE_CLIENT_ID` (cùng giá trị với `GOOGLE_CLIENT_ID`).

Không commit `.env` và `frontend/.env`.

### 3. Khởi tạo cơ sở dữ liệu

```bash
npm run init-db
npm run migrate
```

- `init-db` đọc `database/schema.sql` (15 bảng), tạo database mới rồi **tự nạp dữ liệu mẫu**. Lệnh hỏi xác nhận (nhập `y`); thêm `-- --yes` để bỏ qua: `npm run init-db -- --yes`.
- `init-db` **từ chối** nếu database đã tồn tại; script không xóa hay sửa dữ liệu hiện có.
- Nếu `init-db` lỗi giữa chừng, database vừa tạo được giữ nguyên để kiểm tra. Đổi `DB_NAME` trong `.env` sang tên chưa tồn tại rồi chạy lại.
- `migrate` chạy tuần tự mọi file `.sql` trong `database/migrations/` (hiện có `001_create_notifications_table.sql`, thêm bảng `notifications`). Sau bước này database có **16 bảng**. Mỗi lần chạy `migrate` thực thi lại toàn bộ file, nên các file migration phải dùng `IF NOT EXISTS` hoặc kiểm tra tương đương.
- `npm run seed` chỉ nạp dữ liệu mẫu vào database đã có schema và **còn trống**; script từ chối nếu các bảng đã có dữ liệu.

### 4. Chạy ứng dụng

**Terminal 1: backend**

```bash
# Chế độ phát triển (tự reload với nodemon)
npm run dev
# Hoặc chạy thường
npm start
```

- API: `http://localhost:5000`, kiểm tra tại `http://localhost:5000/api/health`.

**Terminal 2: frontend** (mở terminal mới, vẫn ở thư mục gốc dự án)

```bash
cd frontend
npm run dev
```

- Giao diện: `http://localhost:5173`.

Lệnh frontend khác (chạy trong thư mục `frontend`): `npm run build`, `npm run lint` (oxlint), `npm run preview`.

## Đăng nhập Google

`.env.example` và `frontend/.env.example` đã có sẵn Google Client ID dùng cho demo tại `http://localhost:5173`; sau khi sao chép sang `.env` là dùng được. Nếu ứng dụng Google đang ở chế độ Testing, tài khoản đăng nhập phải nằm trong danh sách Test users.

Muốn dùng Client ID riêng (ví dụ khi triển khai thật):

1. Vào Google Cloud Console, tạo OAuth client ID loại **Web application**.
2. Thêm origin của ứng dụng (ví dụ `http://localhost:5173`) vào **Authorized JavaScript origins**.
3. Điền Client ID vào `GOOGLE_CLIENT_ID` (`.env` ở thư mục gốc) và `VITE_GOOGLE_CLIENT_ID` (`frontend/.env`), rồi khởi động lại backend và frontend.

Không đưa Client secret vào bất kỳ file nào; ứng dụng chỉ cần Client ID.

## Dữ liệu mẫu và tài khoản demo

`init-db` và `seed` tạo tài khoản mẫu cho ba vai trò. Mật khẩu mặc định dùng chung được định nghĩa trong `scripts/seed.js`.

- Chỉ dùng cho môi trường phát triển và demo.
- **Không** chạy `init-db` hoặc `seed` rồi để nguyên tài khoản mẫu trên máy chủ thật; đổi hoặc xóa các tài khoản này trước khi triển khai.

## Kiểm thử

```bash
npm test
```

- Thư mục `tests/` gồm các bộ unit test (không cần database) và integration test (Supertest) cần MySQL đang chạy.
- Nên đặt `DB_NAME` riêng cho môi trường test để không lẫn với dữ liệu phát triển.
- Jest chạy tuần tự (`--runInBand`). Chạy riêng một bộ: `npm test -- tests/auth.test.js`.
- Khi chạy test (`NODE_ENV=test`), giới hạn số lần đăng nhập bị bỏ qua. Muốn thử riêng chức năng này, đặt `FORCE_RATE_LIMIT=true`.

## Migration cũ

Các file `scripts/migrate-google.js`, `migrate-profile-fields.js`, `migrate-token-version.js`, `migrate-upgrade1.js`, `migrate-invoice-payment-status.js` dành cho **database tạo từ phiên bản schema cũ**. Schema hiện tại đã gồm các thay đổi đó, nên cài mới **không cần** chạy chúng. Chạy riêng từng file khi cần nâng cấp, ví dụ:

```bash
node scripts/migrate-profile-fields.js
```

## Cấu trúc thư mục

```
├── database/
│   ├── schema.sql              # Schema 15 bảng
│   └── migrations/             # Migration SQL (001: bảng notifications)
├── scripts/
│   ├── init-db.js              # Khởi tạo database mới, từ chối nếu đã tồn tại
│   ├── seed.js                 # Dữ liệu mẫu
│   ├── migrate.js              # Chạy các file trong database/migrations
│   └── migrate-*.js            # Migration cũ cho database phiên bản trước
├── src/
│   ├── app.js, server.js       # Cấu hình Express và khởi động server
│   ├── config/                 # Kết nối MySQL (pool)
│   ├── routes/                 # Định nghĩa route /api
│   ├── controllers/            # Tầng điều khiển
│   ├── services/               # Tầng nghiệp vụ
│   ├── repositories/           # Tầng truy vấn CSDL
│   ├── validations/            # Kiểm tra dữ liệu đầu vào (Zod)
│   ├── middlewares/            # Xác thực, phân quyền, xử lý lỗi
│   └── utils/                  # Hàm dùng chung
├── tests/                      # Jest và Supertest
├── uploads/                    # Tệp tải lên (không commit)
└── frontend/                   # React SPA: khu vực public, customer, staff, admin
```

## Nhóm API

`/api/health`, `/api/auth`, `/api/auth/google`, `/api/users`, `/api/customers`, `/api/pets`, `/api/services`, `/api/employees`, `/api/shifts`, `/api/employee-shifts`, `/api/appointments`, cùng các API vận hành (nhật ký chăm sóc, ảnh chăm sóc, sự cố) và API hóa đơn, thanh toán.

## Cơ sở dữ liệu

15 bảng trong `database/schema.sql`: `roles`, `users`, `pets`, `services`, `employees`, `shifts`, `employee_shifts`, `appointments`, `appointment_details`, `pet_care_history`, `invoices`, `invoice_details`, `payments`, `incidents`, `system_logs`. Migration `001` thêm bảng `notifications`, tổng cộng 16 bảng.
