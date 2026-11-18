# 🎬 KỊCH BẢN DEMO HỆ THỐNG PET SPA (10 PHÚT)

Kịch bản demo được thiết kế liền mạch theo luồng nghiệp vụ thực tế giữa 3 vai trò:
**Khách hàng (Customer)** ➔ **Nhân viên (Staff)** ➔ **Quản trị viên (Admin)**.

---

## 🎯 Chuẩn bị trước khi Demo
1. Mở Terminal chạy nạp dữ liệu sạch chuẩn:
   ```powershell
   npm run seed-demo
   ```
2. Khởi động Backend & Frontend:
   ```powershell
   npm run dev       # Backend: http://localhost:5000
   cd frontend; npm run dev   # Frontend: http://localhost:5173
   ```
3. Mở trình duyệt tại `http://localhost:5173`.

---

## 🕒 PHẦN 1: KHÁCH HÀNG (CUSTOMER) - 3 PHÚT

* **Mục tiêu**: Trải nghiệm giao diện thân thiện tông hồng, xem dịch vụ và đặt lịch hẹn.

1. **Trang chủ (`/`)**:
   - Giới thiệu giao diện hiện đại, responsive.
   - Trình diễn khối **Dịch vụ nổi bật**: Tắm sấy, Cắt tỉa tạo kiểu, Combo Spa VIP... Bấm xem chi tiết dịch vụ.
   - Xem khối **Đội ngũ kỹ thuật viên** (`/employees`) và quy trình chăm sóc.

2. **Đăng nhập Khách hàng**:
   - Bấm **Đăng nhập**, dùng tài khoản demo:
     - Email: `khachhang1@gmail.com`
     - Mật khẩu: `Password123@`
   - Quan sát menu trên header: Thú cưng của tôi, Lịch hẹn của tôi, Sổ tay chăm sóc, Chuông thông báo (🔔).

3. **Đặt lịch Spa mới (`/booking`)**:
   - Chọn bé **Bông Xù (Poodle)**.
   - Chọn dịch vụ: **Cắt tỉa tạo kiểu Grooming**.
   - Chọn ngày: Hôm nay hoặc ngày mai. Hệ thống tự động lọc các khung giờ trống không trùng lịch và đủ thời gian đệm 15 phút.
   - Nhập ghi chú: *"Bé hơi sợ máy sấy to, nhờ nhân viên nhẹ tay"*.
   - Nhấn **Xác nhận đặt lịch** ➔ Trạng thái lịch ban đầu là `Chờ xác nhận (pending)`.
   - Chuông thông báo trên Header lập tức nhảy số thông báo mới.

---

## 🕒 PHẦN 2: NHÂN VIÊN VẬN HÀNH (STAFF) - 4 PHÚT

* **Mục tiêu**: Vận hành quy trình chăm sóc thực tế theo máy trạng thái và Kanban trực quan.

1. **Đăng nhập Nhân viên**:
   - Đăng xuất khách hàng, đăng nhập tài khoản nhân viên:
     - Email: `staff1@petspa.com`
     - Mật khẩu: `Password123@`
   - Giao diện tự động chuyển sang tông xanh chuyên nghiệp của Staff.

2. **Dashboard Nhân viên (`/staff`)**:
   - Xem thống kê ca làm việc hôm nay: **Ca sáng (08:00 - 13:00)**.
   - Xem số lượng lịch cần làm trong ngày và số lịch đã hoàn thành trong tháng.

3. **Điều phối quy trình bằng Kanban (`/staff/today`)**:
   - Mở màn hình **Hôm nay (Kanban)** với 4 cột trạng thái:
     - Cột 1: **Đã xác nhận** (Lịch hẹn của bé Bông Xù vừa đặt).
     - Cột 2: **Đã tiếp nhận**.
     - Cột 3: **Đang thực hiện**.
     - Cột 4: **Đã hoàn tất**.
   - **Bước 1 - Tiếp nhận**: Bấm vào thẻ bé Bông Xù ➔ Mở modal ghi nhận tình trạng ban đầu (ví dụ: *"Lông rối nhẹ vùng tai, da sạch không nấm rận"*) và chọn ảnh trước khi làm ➔ Thẻ tự nhảy sang cột **Đã tiếp nhận**.
   - **Bước 2 - Bắt đầu**: Bấm thẻ ➔ Xác nhận bắt đầu làm dịch vụ ➔ Thẻ chuyển sang **Đang thực hiện**.
   - **Bước 3 - Hoàn tất**: Bấm thẻ ➔ Nhập ghi chú quá trình thực hiện (*"Bé ngoan, đã sấy phồng và tạo kiểu mặt tròn"*) + lời khuyên tại nhà + chọn ảnh sau khi làm ➔ Bấm hoàn tất ➔ Thẻ chuyển sang **Đã hoàn tất**.

4. **Ghi nhận sự cố phát sinh (`/staff/incidents`)**:
   - Thao tác nhanh gửi báo cáo sự cố (ví dụ: phát hiện bé có vết xước cũ ở chân) để Admin nắm bắt và hỗ trợ khách hàng.

---

## 🕒 PHẦN 3: QUẢN TRỊ VIÊN (ADMIN) - 3 PHÚT

* **Mục tiêu**: Báo cáo doanh thu, hiệu suất, kiểm toán và giám sát toàn diện.

1. **Đăng nhập Quản trị viên**:
   - Đăng nhập tài khoản Admin:
     - Email: `admin@petspa.com`
     - Mật khẩu: `Password123@`
   - Giao diện Admin tông tím/xanh hiện đại.

2. **Bảng điều khiển Admin (`/admin`)**:
   - Xem 4 thẻ số liệu tức thời: Doanh thu hôm nay, Doanh thu tháng này, Tổng lịch hẹn hôm nay, Sự cố đang mở.
   - Biểu đồ tròn Recharts thể hiện tỷ lệ các trạng thái lịch hôm nay.
   - Danh sách nhân viên đang trong ca trực hôm nay.

3. **Báo cáo & Thống kê chuyên sâu (`/admin/reports`)**:
   - **Tab Doanh thu**: Xem biểu đồ cột doanh thu theo ngày/tháng, bảng chi tiết hóa đơn.
   - Bấm **"Xuất CSV (Excel)"** ➔ Tải file CSV mở trên Excel có sẵn tiếng Việt có dấu nhờ BOM `\ufeff`, có dòng tiêu đề thương hiệu và dòng Tổng cộng.
   - **Tab Dịch vụ**: Xem top dịch vụ được ưa chuộng nhất.
   - **Tab Hiệu suất nhân viên**: Xem số lịch hoàn tất, doanh thu mang lại và tỷ lệ hủy theo từng nhân viên.
   - **Tab Khung giờ cao điểm**: Biểu đồ phân tích khung giờ nào khách đến đông nhất để phân bổ nhân sự.

4. **Nhật ký kiểm toán (`/admin/logs`)**:
   - Tra cứu lại lịch sử toàn bộ thao tác vừa làm: `CHECK_IN_APPOINTMENT`, `COMPLETE_APPOINTMENT`...
   - Bấm **"Xem thay đổi"** để xem snapshot `Old Values` và `New Values`, chứng minh hệ thống minh bạch và bảo mật tuyệt đối (không lộ mật khẩu).

---

## 🏁 KẾT THÚC DEMO (1 PHÚT TỔNG KẾT)
- Nhấn mạnh tính an toàn: Compare-and-set chống click đúp, tự phân công cân bằng tải, bảo mật Helmet, CORS, Rate Limit.
- Cảm ơn Hội đồng phản biện và chuyển sang phần Hỏi - Đáp (Q&A).
