-- ====================================================================
-- DỮ LIỆU MẪU BAN ĐẦU (SEED DATA - TĨNH)
-- FILE: database/seed.sql
-- GHI CHÚ QUAN TRỌNG:
-- 1. Để đảm bảo mã băm mật khẩu bcrypt khớp chính xác với "Password123@"
--    và lịch phân ca (employee_shifts) tự sinh động cho 30 ngày tính từ
--    thời điểm thực tế, vui lòng sử dụng lệnh:
--        npm run seed
--    hoặc lệnh khởi tạo trọn gói:
--        npm run init-db
-- 2. Tệp seed.sql này chỉ lưu giữ các dữ liệu danh mục tĩnh cốt lõi
--    (Vai trò, Dịch vụ spa, Khung ca chuẩn) và đã loại bỏ hoàn toàn
--    các chuỗi băm cứng và ngày phân ca cứng.
-- ====================================================================

USE `pet_spa_db`;

-- 1. Thêm Vai trò chuẩn (Roles)
INSERT INTO `roles` (`id`, `role_name`, `display_name`, `description`) VALUES
(1, 'admin', 'Quản trị viên', 'Toàn quyền quản trị hệ thống, báo cáo, tài khoản, nhân sự và cấu hình'),
(2, 'staff', 'Nhân viên Spa', 'Tiếp nhận thú cưng, cập nhật tiến độ, chăm sóc và lập hóa đơn'),
(3, 'customer', 'Khách hàng', 'Đặt lịch hẹn, quản lý hồ sơ thú cưng, xem lịch sử và hóa đơn')
ON DUPLICATE KEY UPDATE `display_name` = VALUES(`display_name`), `description` = VALUES(`description`);

-- 2. Thêm Danh mục Dịch vụ Spa chuẩn (Services)
INSERT INTO `services` (`id`, `name`, `description`, `price`, `duration_minutes`, `is_active`) VALUES
(1, 'Combo Tắm Sấy & Vệ Sinh Toàn Diện', 'Bao gồm: Cắt dũa móng, vệ sinh tai kẽ chân, vắt tuyến hôi, tắm 2 lần sữa tắm dưỡng lông, sấy phồng và xịt nước hoa thơm lâu', 200000.00, 60, TRUE),
(2, 'Cắt Tỉa Lông Tạo Kiểu Trọn Gói', 'Bao gồm gói combo tắm sấy vệ sinh + Cắt tỉa tạo form mặt tròn Teddy/Gấu bông/Hàn Quốc theo yêu cầu', 350000.00, 90, TRUE),
(3, 'Cạo Lông / Vệ Sinh Bụng Mông Gọn Gàng', 'Cạo lông đệm chân, bụng và hậu môn giúp giữ vệ sinh sạch sẽ', 120000.00, 30, TRUE),
(4, 'Tắm Bùn Khoáng / Thảo Dược Trị Liệu Da', 'Liệu trình giảm ngứa, phục hồi da nấm vảy gàu bằng bùn khoáng thiên nhiên Nhật Bản', 280000.00, 60, TRUE),
(5, 'Gỡ Rối Lông Chuyên Sâu (Tính theo giờ)', 'Gỡ rối bằng xịt chuyên dụng và lược kim không làm đứt lông của bé', 150000.00, 45, TRUE)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price` = VALUES(`price`), `duration_minutes` = VALUES(`duration_minutes`);

-- 3. Thêm Khung Ca Làm Việc Chuẩn (Shifts)
INSERT INTO `shifts` (`id`, `shift_name`, `start_time`, `end_time`, `description`) VALUES
(1, 'Ca Sáng', '08:00:00', '13:00:00', 'Ca sáng phục vụ các bé đặt lịch sớm'),
(2, 'Ca Chiều', '13:00:00', '18:00:00', 'Ca chiều cao điểm spa và grooming'),
(3, 'Ca Tối', '18:00:00', '21:00:00', 'Ca phụ vụ khách hàng sau giờ hành chính')
ON DUPLICATE KEY UPDATE `shift_name` = VALUES(`shift_name`), `start_time` = VALUES(`start_time`), `end_time` = VALUES(`end_time`);
