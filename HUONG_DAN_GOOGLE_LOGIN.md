# Đăng nhập bằng Google – Hướng dẫn cấu hình (Windows)

## 1. Cài đặt thư viện

Mở CMD tại thư mục dự án `E:\Do_an_chuyen_nganh` và chạy:

```cmd
cd /d E:\Do_an_chuyen_nganh
npm install google-auth-library
```

## 2. Cập nhật cơ sở dữ liệu

Chạy lệnh migration để bổ sung các trường cần thiết mà không làm mất dữ liệu hiện có:

```cmd
node backend/scripts/migrate-google.js
```

Migration sẽ:
- Thêm cột `google_id` để lưu mã định danh tài khoản Google.
- Cho phép cột `phone` nhận giá trị `NULL` đối với người dùng đăng nhập Google chưa cung cấp số điện thoại.

Đồng thời, cập nhật `database/schema.sql` trong bảng `users`:

```sql
google_id VARCHAR(64) NULL UNIQUE,
```

Điều chỉnh cột `phone` cho phép `NULL`.

## 3. Đăng ký route Google Authentication

Mở file `src/routes/index.js` và thêm:

```js
import googleAuthRoutes from './googleAuthRoutes.js';
```

Đăng ký route Google trước route xác thực thông thường:

```js
router.use('/auth/google', googleAuthRoutes);
router.use('/auth', authRoutes);
```

## 4. Cấu hình Google Client ID

Client ID là mã công khai, không phải Client Secret.

**File `.env` ở thư mục backend:**

```env
GOOGLE_CLIENT_ID=842033757101-u3k5elmcj5i8h14d3airqsha9p83e686.apps.googleusercontent.com
```

**File `frontend/.env`:**

```env
VITE_GOOGLE_CLIENT_ID=842033757101-u3k5elmcj5i8h14d3airqsha9p83e686.apps.googleusercontent.com
```

Nếu chưa có file `frontend/.env`, hãy tạo mới.

Sau khi cập nhật `.env`, khởi động lại backend và frontend bằng `npm run dev`.

## 5. Chạy kiểm thử

Tại thư mục backend, chạy:

```cmd
npm test
```

Có thêm 9 test mới (G1–G9) trong `tests/googleLogin.test.js`. Các test giả lập Google nên không cần kết nối mạng.

## 6. Tích hợp giao diện đăng nhập

Component `GoogleLoginButton` đã có sẵn. Kiểm tra và tích hợp vào:
- `LoginPage.jsx`
- `AuthContext.jsx`

Đảm bảo đăng nhập Google thành công sẽ cập nhật trạng thái người dùng và token tương tự đăng nhập thông thường.

## 7. Lưu ý bảo mật

- Nên reset Client Secret trong Google Cloud Console vì file JSON chứa thông tin bí mật đã được gửi trong cuộc trò chuyện trước đó. Luồng đăng nhập này không sử dụng Client Secret.
- Không đưa file `client_secret_*.json` lên Git. Thêm vào `.gitignore`:

```gitignore
client_secret*.json
```

- Khi ứng dụng ở chế độ Testing, chỉ những email được thêm vào mục Test users trong màn hình OAuth consent mới có thể đăng nhập.
