# Đăng nhập bằng Google – hướng dẫn áp dụng (Windows)

## 1. Chép file và cài thư viện
```
xcopy "%USERPROFILE%\Downloads\google-login" "E:\Do_an_chuyen_nganh" /E /Y
cd E:\Do_an_chuyen_nganh
npm install google-auth-library
```

## 2. Cập nhật CSDL (không mất dữ liệu)
```
node backend/scripts/migrate-google.js
```
Thêm cột `google_id` và cho phép `phone` để trống (người đăng nhập Google chưa có số điện thoại).
Đồng thời sửa `database/schema.sql` bảng `users`: thêm `google_id VARCHAR(64) NULL UNIQUE,` và đổi `phone` thành cho phép NULL.

## 3. Gắn route – `src/routes/index.js`
```js
import googleAuthRoutes from './googleAuthRoutes.js';
...
router.use('/auth/google', googleAuthRoutes);   // đặt TRƯỚC dòng router.use('/auth', authRoutes)
```

## 4. Khai báo Client ID (đây là mã công khai, KHÔNG phải client_secret)
- File `.env` ở thư mục gốc (backend):  `GOOGLE_CLIENT_ID=842033757101-u3k5elmcj5i8h14d3airqsha9p83e686.apps.googleusercontent.com`
- File `frontend/.env` (tạo mới nếu chưa có):  `VITE_GOOGLE_CLIENT_ID=842033757101-u3k5elmcj5i8h14d3airqsha9p83e686.apps.googleusercontent.com`
Khởi động lại cả backend và `npm run dev` của frontend sau khi sửa `.env`.

## 5. Chạy test
```
npm test
```
Có thêm 9 test mới (G1–G9) trong `tests/googleLogin.test.js`; các test này giả lập Google nên không cần mạng.

## 6. Giao diện
Nút `GoogleLoginButton` đã có sẵn; gắn vào trang đăng nhập (cần xem LoginPage.jsx và AuthContext.jsx).

## Bảo mật
- Nên bấm "Reset secret" cho client secret trong Google Cloud Console vì file JSON đã bị gửi trong khung chat; luồng này không dùng secret.
- Không đưa file `client_secret_*.json` lên git (thêm `client_secret*.json` vào `.gitignore`).
- Khi ứng dụng ở chế độ "Testing", chỉ các email trong mục "Test users" của màn hình OAuth consent mới đăng nhập được.
