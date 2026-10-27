# Nâng cấp 1 – hướng dẫn áp dụng (Windows)

## 0. Giải nén và chép đè
```
xcopy "%USERPROFILE%\Downloads\nang-cap-1" "E:\Do_an_chuyen_nganh" /E /Y
```

## 1. Cập nhật CSDL (KHÔNG mất dữ liệu)
```
cd E:\Do_an_chuyen_nganh
node backend/scripts/migrate-upgrade1.js
```
Thấy "Đã thêm cột pets.birth_month" là đúng. Thú cưng cũ có số tháng tuổi sẽ được tự suy ra tháng sinh gần đúng.

## 2. Sửa `database/schema.sql`
Trong bảng `pets`, thêm dòng sau ngay sau dòng `age_months`:
```
birth_month DATE NULL,
```

## 3. Gắn route khách hàng – `src/routes/index.js`
Thêm import: `import customerRoutes from './customerRoutes.js';`
Thêm dòng: `router.use('/customers', customerRoutes);`

## 4. Bọc ứng dụng bằng FeedbackProvider – `frontend/src/main.jsx`
```jsx
import { FeedbackProvider } from './components/Feedback'
// ...
<FeedbackProvider>
  <App />
</FeedbackProvider>
```

## 5. `.gitignore` phải có dòng `uploads/`

## 6. Chạy test
```
npm test
```
Kỳ vọng: toàn bộ pass (có thêm 16 test mới N1–N16 trong tests/upgrade1.test.js).
