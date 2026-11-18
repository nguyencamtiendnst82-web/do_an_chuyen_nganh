# 📚 TÀI LIỆU HỆ THỐNG API - PET SPA MANAGEMENT SYSTEM

Hệ thống cung cấp RESTful API tuân thủ chuẩn JSON response:
```json
{
  "success": true,
  "message": "Thông báo kết quả",
  "data": { ... }
}
```
Lỗi trả về:
```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "errors": [ ... ]
}
```

---

## 🔐 1. Xác thực & Tài khoản (`/api/auth`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản khách hàng mới |
| `POST` | `/api/auth/login` | Public | Đăng nhập bằng Email/SĐT + Mật khẩu (rate limit: 10 lần/15p) |
| `POST` | `/api/auth/google` | Public | Đăng nhập/Đăng ký qua Google OAuth |
| `POST` | `/api/auth/logout` | Authenticated | Đăng xuất |
| `GET` | `/api/auth/me` | Authenticated | Lấy thông tin tài khoản hiện tại |
| `PATCH` | `/api/auth/me` | Authenticated | Cập nhật hồ sơ (họ tên, sđt, địa chỉ, giới tính, năm sinh) |
| `POST` | `/api/auth/change-password`| Authenticated | Đổi mật khẩu (tự động vô hiệu hóa token cũ qua `token_version`) |
| `POST` | `/api/auth/avatar` | Authenticated | Tải lên ảnh đại diện |

---

## 🐶 2. Quản lý Thú cưng (`/api/pets`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/pets` | Customer / Staff / Admin | Khách xem thú của mình; Nhân viên & Admin xem tất cả |
| `POST` | `/api/pets` | Customer / Staff / Admin | Thêm mới hồ sơ thú cưng |
| `GET` | `/api/pets/:id` | Customer / Staff / Admin | Xem chi tiết thú cưng (chặn IDOR cho khách) |
| `PUT` | `/api/pets/:id` | Customer / Staff / Admin | Cập nhật thông tin thú cưng |
| `DELETE` | `/api/pets/:id` | Customer / Admin | Ẩn hồ sơ thú cưng (chặn nếu còn lịch chưa xong) |
| `GET` | `/api/pets/:id/care-history` | Authenticated | Xem sổ tay chăm sóc của thú cưng |

---

## ✂️ 3. Dịch vụ Spa (`/api/services`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/services/public` | Public | Danh sách dịch vụ đang mở phục vụ khách |
| `GET` | `/api/services` | Staff / Admin | Danh sách toàn bộ dịch vụ (kể cả dịch vụ ẩn) |
| `POST` | `/api/services` | Admin | Tạo dịch vụ mới (giá, thời lượng, ảnh, mô tả) |
| `PUT` | `/api/services/:id` | Admin | Sửa dịch vụ |
| `PATCH`| `/api/services/:id/status`| Admin | Bật / ẩn dịch vụ |

---

## ⏰ 4. Ca làm việc & Nhân viên (`/api/shifts`, `/api/employees`, `/api/employee-shifts`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/employees` | Public / Customer | Xem danh sách đội ngũ kỹ thuật viên (đã ẩn thông tin nhạy cảm) |
| `GET` | `/api/shifts` | Staff / Admin | Danh sách các khung ca làm việc |
| `POST` | `/api/shifts` | Admin | Tạo khung ca làm việc mới |
| `GET` | `/api/employee-shifts/me`| Staff | Xem lịch phân ca của bản thân |
| `GET` | `/api/employee-shifts` | Admin | Quản lý bảng phân ca toàn bộ nhân viên |
| `POST` | `/api/employee-shifts` | Admin | Phân ca làm việc cho nhân viên |

---

## 📅 5. Đặt lịch & Vận hành (`/api/appointments`)

Máy trạng thái lịch hẹn: `pending` → `confirmed` → `checked_in` → `in_progress` → `completed` (hủy từ `pending`/`confirmed`).

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/appointments/availability`| Public / Customer | Tra cứu khung giờ trống hợp lệ (tính thời gian đệm 15p) |
| `GET` | `/api/appointments` | Customer / Staff / Admin | Xem lịch hẹn (Khách xem của mình, Staff xem lịch được gán) |
| `POST` | `/api/appointments` | Customer / Staff / Admin | Đặt lịch mới (tự gán nhân viên cân bằng tải) |
| `PATCH`| `/api/appointments/:id/cancel` | Customer / Staff / Admin | Hủy lịch hẹn (bắt buộc nhập lý do) |
| `PATCH`| `/api/appointments/:id/status` | Staff / Admin | Xác nhận lịch (`pending` → `confirmed`) |
| `PATCH`| `/api/appointments/:id/check-in`| Staff / Admin | Tiếp nhận thú cưng (tình trạng ban đầu + ảnh trước) |
| `PATCH`| `/api/appointments/:id/start` | Staff / Admin | Bắt đầu làm dịch vụ (`checked_in` → `in_progress`) |
| `PATCH`| `/api/appointments/:id/complete`| Staff / Admin | Hoàn tất dịch vụ (ghi chú chăm sóc + ảnh sau) |

---

## ⚠️ 6. Sự cố vận hành (`/api/incidents`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/incidents` | Staff / Admin | Ghi nhận sự cố trong quá trình phục vụ |
| `GET` | `/api/incidents` | Staff / Admin | Danh sách sự cố (Staff xem của mình, Admin xem tất cả) |
| `GET` | `/api/incidents/:id` | Staff / Admin | Chi tiết sự cố |
| `PATCH`| `/api/incidents/:id` | Admin | Cập nhật hướng xử lý và đóng sự cố (`resolved`) |

---

## 🧾 7. Hóa đơn & Thanh toán (`/api/invoices`, `/api/payments`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/invoices` | Staff / Admin | Lập hóa đơn cho lịch hẹn (tự động tính tiền server-side) |
| `GET` | `/api/invoices/:id` | Customer / Staff / Admin | Chi tiết hóa đơn (khách chỉ xem hóa đơn của mình) |
| `GET` | `/api/invoices/:id/vietqr`| Customer / Staff / Admin | Tạo mã VietQR mô phỏng thanh toán chuyển khoản |
| `POST` | `/api/payments` | Staff / Admin | Ghi nhận giao dịch thanh toán (tiền mặt/chuyển khoản) |

---

## 📈 8. Báo cáo & Thống kê (`/api/reports`)

*(Chỉ dành riêng cho Quản trị viên - Admin)*

| Phương thức | Endpoint | Tham số Query | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/revenue` | `from`, `to`, `groupBy=day\|month`, `format=json\|csv` | Doanh thu theo kỳ (hóa đơn `paid`), số lượng, trung bình |
| `GET` | `/api/reports/services` | `from`, `to`, `format=json\|csv` | Dịch vụ bán chạy (số lượt đặt, doanh thu) |
| `GET` | `/api/reports/employees` | `from`, `to`, `format=json\|csv` | Hiệu suất nhân viên, số lịch hoàn tất, tỉ lệ hủy |
| `GET` | `/api/reports/appointments`| `from`, `to`, `format=json\|csv` | Thống kê trạng thái lịch & khung giờ cao điểm |
| `GET` | `/api/reports/customers`| `from`, `to`, `format=json\|csv` | Khách hàng mới theo kỳ, khách hàng quay lại |

---

## 📊 9. Dashboard (`/api/dashboard`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/admin` | Admin | Số liệu doanh thu hôm nay/tháng, lịch hôm nay, ca trực, sự cố |
| `GET` | `/api/dashboard/staff` | Staff / Admin | Lịch hôm nay của tôi, ca trực của tôi, số lịch xong trong tháng |

---

## 📋 10. Nhật ký hệ thống (`/api/logs`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/logs` | Admin | Tra cứu nhật ký kiểm toán `system_logs` (phân trang, lọc action, ẩn dữ liệu nhạy cảm) |

---

## 🔔 11. Thông báo (`/api/notifications`)

| Phương thức | Endpoint | Quyền hạn | Mô tả |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Authenticated | Danh sách thông báo cá nhân (phân trang, chưa đọc) |
| `PATCH`| `/api/notifications/:id/read` | Authenticated | Đánh dấu một thông báo đã đọc |
| `PATCH`| `/api/notifications/read-all`| Authenticated | Đánh dấu tất cả thông báo là đã đọc |
