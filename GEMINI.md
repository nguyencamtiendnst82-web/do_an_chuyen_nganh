# DỰ ÁN: Website quản lý và vận hành dịch vụ Spa thú cưng (Pet Spa System)
Đồ án chuyên ngành – chạy trên localhost. Trả lời, comment và thông báo lỗi hiển thị cho người dùng bằng TIẾNG VIỆT; tên biến/hàm/file bằng tiếng Anh.

## Công nghệ (bắt buộc, không đổi)
- Front-end: React + Vite (JavaScript), React Router, Axios, giao diện responsive (mobile-first). Dùng Tailwind CSS.
- Back-end: Node.js + Express.js (CommonJS hoặc ESM, chọn một và giữ nhất quán), kiến trúc MVC phân lớp: routes -> controllers -> services -> repositories(models).
- CSDL: MySQL 8, driver mysql2/promise dùng connection pool, LUÔN dùng prepared statement (placeholder ?), không nối chuỗi SQL.
- Xác thực: JWT (access token, hạn 8h) + bcrypt (cost 10). Lưu token ở client (localStorage) và gửi qua header Authorization: Bearer.
- Validate dữ liệu: zod hoặc joi ở mọi endpoint ghi dữ liệu.
- Test: Jest + Supertest (back-end). Có kèm collection Postman export.
- Bảo mật: helmet, cors (chỉ origin localhost:5173), express-rate-limit cho /auth, không trả password_hash ra API, không log mật khẩu.

## Nguồn sự thật về CSDL
- File database/schema.sql là CHUẨN. KHÔNG tự ý đổi tên bảng/cột. Nếu cần thay đổi schema, tạo file migration mới database/migrations/00X_*.sql và giải thích lý do trước khi làm.
- Ba vai trò: admin, staff, customer (bảng roles). Bảng employees mở rộng 1-1 từ users có role staff.

## Quy tắc nghiệp vụ cốt lõi (áp dụng ở SERVER, không tin client)
1. Phân quyền kiểm tra ở middleware phía server (authenticate + authorize(...roles)). Customer chỉ xem/sửa dữ liệu của chính mình (kiểm tra ownership). Staff không được sửa giá dịch vụ, không quản lý tài khoản. Admin toàn quyền.
2. Giá và tổng tiền (price_at_booking, subtotal, total_amount) luôn do server tính từ bảng services; bỏ qua mọi giá trị tiền do client gửi lên.
3. Đặt lịch: end_time = start_time + tổng duration_minutes của các dịch vụ. Chống trùng lịch theo nhân viên và theo thú cưng (một pet không thể có 2 lịch chồng giờ). Chỉ tính các lịch có status khác cancelled. Phải kiểm tra trong TRANSACTION kèm khóa dòng (SELECT ... FOR UPDATE) để tránh race condition. Lịch phải nằm trọn trong ca làm (employee_shifts + shifts) của nhân viên ngày đó và không được đặt vào quá khứ.
4. Luồng trạng thái lịch hẹn: pending -> confirmed -> checked_in -> in_progress -> completed; pending/confirmed -> cancelled. Không cho nhảy trạng thái sai thứ tự. Khách chỉ được hủy khi còn pending/confirmed và trước giờ hẹn tối thiểu 2 giờ; hủy phải có cancellation_reason.
5. Hóa đơn chỉ lập khi lịch hẹn completed; mỗi lịch hẹn đúng 1 hóa đơn (UNIQUE). Phụ phí tùy chỉnh (gỡ rối lông, phụ thu...) là dòng invoice_details có service_id NULL. Thanh toán là MÔ PHỎNG (cash, bank_transfer, momo_simulated, card), không tích hợp cổng thật; VietQR chỉ hiển thị mã minh họa, không tự xác nhận giao dịch.
6. Mọi thao tác quan trọng (tạo/hủy lịch, gán nhân viên, đổi trạng thái, sửa/lập hóa đơn, đổi giá dịch vụ, khóa tài khoản) ghi vào system_logs với old_values/new_values (JSON), ip_address, user_agent.
7. DECIMAL của MySQL trả về dạng chuỗi: chuyển sang number/định dạng VND ở tầng response; không dùng float để cộng tiền ở server (dùng số nguyên đồng hoặc thư viện decimal).
8. Định dạng response thống nhất: { success: boolean, message: string, data?: any, errors?: any[] }. HTTP status đúng ngữ nghĩa (400/401/403/404/409/422/500). Có error-handling middleware tập trung.

## Phạm vi (OUT OF SCOPE – tuyệt đối không làm)
Native mobile app, cổng thanh toán thật, SMS/Zalo tự động, AI chẩn đoán/xử lý ảnh, microservices, WebSocket realtime.

## Cách làm việc
- Làm đúng phạm vi của prompt hiện tại, không làm lan sang phân hệ khác.
- Mỗi tính năng có validate, xử lý lỗi, và ít nhất 1 test cho luồng chính + 1 test cho luồng lỗi/phân quyền.
- Cấu hình qua .env (có .env.example), không commit secret.
- Cuối mỗi prompt: liệt kê file đã tạo/sửa, cách chạy, cách kiểm tra thủ công.