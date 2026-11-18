# 🧪 BÁO CÁO KIỂM THỬ HỆ THỐNG PET SPA

* **Ngày thực hiện**: Tháng 11/2026
* **Công cụ kiểm thử**: Jest 29 + Supertest 7 (Backend API), Vite Rollup Build & React Testing (Frontend).
* **Môi trường chạy**: Node.js v20+, MySQL 8.0+, Windows PowerShell.

---

## 📊 1. Tổng quan kết quả kiểm thử

| Chỉ số | Kết quả thực tế | Tỷ lệ đạt |
| :--- | :---: | :---: |
| **Tổng số Test Suites** | **30 / 30 Passed** | **100%** |
| **Tổng số Test Cases** | **301 / 301 Passed** | **100%** |
| **Số test bị Fail/Error** | **0** | **0%** |
| **Frontend Production Build** | **Success (0 warning lỗi)** | **100%** |

---

## 📋 2. Bảng phân loại Test Cases theo phân hệ

| STT | Phân hệ / Tính năng | File Test | Số Test | Trạng thái |
| :---: | :--- | :--- | :---: | :---: |
| 1 | Kiểm tra sức khỏe & xử lý lỗi 404 | `tests/health.test.js` | 2 | ✅ PASS |
| 2 | Xác thực tài khoản, Đăng ký, Đăng nhập, Quên mật khẩu | `tests/auth.test.js` | 13 | ✅ PASS |
| 3 | Đổi mật khẩu & Vô hiệu hóa Token cũ (`token_version`) | `tests/changePassword.test.js`, `tests/tokenInvalidation.test.js` | 15 | ✅ PASS |
| 4 | Đăng nhập Google OAuth | `tests/googleLogin.test.js` | 9 | ✅ PASS |
| 5 | Quản lý dịch vụ Spa & Ẩn/Hiện dịch vụ | `tests/services.test.js`, `tests/publicServices.test.js` | 17 | ✅ PASS |
| 6 | Quản lý thú cưng & Chống IDOR (truy cập chéo) | `tests/pets.test.js` | 17 | ✅ PASS |
| 7 | Nhân viên, Ca làm việc & Chống trùng giờ phân ca | `tests/employees.test.js`, `tests/shifts.test.js` | 24 | ✅ PASS |
| 8 | Đặt lịch: Máy trạng thái, Đệm 15p, Cân bằng tải | `tests/appointments.test.js`, `tests/appointmentState.test.js` | 25 | ✅ PASS |
| 9 | Thuật toán kiểm tra trùng lịch (Overlap Checking) | `tests/overlap.test.js` | 8 | ✅ PASS |
| 10 | Quy trình Chăm sóc (Checkin, Start, Complete, Incident) | `tests/careOps.test.js` | 15 | ✅ PASS |
| 11 | Hóa đơn, Tính tiền server-side & Thanh toán VietQR | `tests/invoices.test.js`, `tests/invoiceService.unit.test.js` | 19 | ✅ PASS |
| 12 | Thông báo trong ứng dụng (In-app Notifications) | `tests/notifications.test.js`, `tests/notificationService.unit.test.js` | 12 | ✅ PASS |
| 13 | **Báo cáo, Thống kê, Dashboard & Logs (ĐỢT 5)** | `tests/reports.test.js` | 15 | ✅ PASS |
| 14 | **Bảo mật: Helmet, CORS, Rate Limit, Chặn DoS (ĐỢT 6)** | `tests/security.test.js` | 4 | ✅ PASS |
| 15 | Các bài kiểm thử đơn vị & di chuyển dữ liệu khác | Các file `*.unit.test.js` | 106 | ✅ PASS |

---

## 🎯 3. Chi tiết một số Test Cases trọng yếu

### A. Phân quyền và Bảo mật (Security & Authorization)
- **TC-SEC-01**: Khách hàng gọi API báo cáo doanh thu Admin ➔ Trả về mã lỗi `403 Forbidden`.
- **TC-SEC-02**: Nhân viên gọi API xem nhật ký hệ thống `system_logs` ➔ Trả về `403 Forbidden`.
- **TC-SEC-03**: Khách hàng A cố tình truy cập hoặc sửa hồ sơ thú cưng của Khách hàng B ➔ Trả về `404 Not Found` (không trả 403 để tránh lộ thông tin sự tồn tại).
- **TC-SEC-04**: Gửi body JSON kích thước lớn hơn 2MB ➔ Trả về `413 Payload Too Large` (chống DoS bộ nhớ).
- **TC-SEC-05**: Nhập sai mật khẩu liên tiếp quá 10 lần trong 15 phút ➔ Trả về `429 Too Many Requests`.

### B. Nghiệp vụ vận hành Spa & Máy trạng thái
- **TC-OPS-01**: Đặt lịch 2 khách song song cùng 1 nhân viên cùng khung giờ ➔ Đúng 1 request thành công, 1 request trả về `409 Conflict`.
- **TC-OPS-02**: Thời gian đệm 15 phút giữa 2 lịch hẹn ➔ Lịch kề sát bị chặn 409, cách đúng 15 phút được chấp thuận.
- **TC-OPS-03**: Nhảy cóc trạng thái (từ `pending` bấm thẳng `complete`) ➔ Bị chặn `409 / 422`.
- **TC-OPS-04**: Nhân viên hoàn tất dịch vụ nhưng để trống ghi chú chăm sóc ➔ Bị chặn `422 Unprocessable Entity`.

### C. Báo cáo & Xuất dữ liệu Excel/CSV
- **TC-REP-01**: Lọc báo cáo doanh thu với `from > to` hoặc khoảng cách lớn hơn 366 ngày ➔ Báo lỗi `400 Bad Request`.
- **TC-REP-02**: Doanh thu chỉ tính các hóa đơn ở trạng thái `paid` (đã thanh toán), không cộng hóa đơn `unpaid`.
- **TC-REP-03**: Xuất file CSV có chứa BOM `\ufeff` giúp Excel mở trực tiếp không lỗi font tiếng Việt.
- **TC-REP-04**: Chống CSV Injection: Các ô dữ liệu chứa ký tự `=`, `+`, `-`, `@` được tự động chèn dấu `'` ở đầu ô.

---

## ✅ 4. Kết luận
Toàn bộ các yêu cầu phi chức năng và chức năng của đồ án đều đã được xác thực qua bài kiểm thử tự động, mã nguồn đạt tính ổn định cao, sẵn sàng phục vụ nghiệm thu và bảo vệ đồ án.
