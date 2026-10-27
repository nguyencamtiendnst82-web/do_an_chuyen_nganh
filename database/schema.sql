-- ====================================================================
-- HỆ THỐNG QUẢN LÝ VÀ VẬN HÀNH DỊCH VỤ SPA THÚ CƯNG (PET SPA SYSTEM)
-- FILE: database/schema.sql
-- MỤC ĐÍCH: Khởi tạo toàn bộ cấu trúc bảng, quan hệ, chỉ mục (Indexes)
-- TƯƠNG THÍCH: MySQL 8.0+ / MariaDB 10.5+
-- ====================================================================

DROP DATABASE IF EXISTS `pet_spa_db`;
CREATE DATABASE `pet_spa_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pet_spa_db`;

-- ====================================================================
-- 1. PHÂN HỆ TÀI KHOẢN VÀ BẢO MẬT (F01 - F04)
-- ====================================================================

-- Bảng vai trò người dùng (Roles)
CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `role_name` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Tên định danh vai trò: admin, staff, customer',
    `display_name` VARCHAR(100) NOT NULL COMMENT 'Tên hiển thị: Quản trị viên, Nhân viên, Khách hàng',
    `description` VARCHAR(255) NULL COMMENT 'Mô tả quyền hạn của vai trò',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Bảng định nghĩa vai trò người dùng trong hệ thống';

-- Bảng tài khoản người dùng (Users)
CREATE TABLE `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `role_id` INT NOT NULL COMMENT 'FK liên kết tới roles(id)',
    `full_name` VARCHAR(100) NOT NULL COMMENT 'Họ và tên người dùng',
    `email` VARCHAR(150) NOT NULL UNIQUE COMMENT 'Địa chỉ email duy nhất (dùng đăng nhập)',
    `phone` VARCHAR(20) UNIQUE COMMENT 'Số điện thoại liên hệ duy nhất',
    `google_id` VARCHAR(64) NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL COMMENT 'Mật khẩu đã mã hóa bằng bcrypt',
    `token_version` INT NOT NULL DEFAULT 0 COMMENT 'Tăng mỗi khi đổi mật khẩu để vô hiệu hóa JWT cũ',
    `avatar_url` VARCHAR(255) NULL COMMENT 'Đường dẫn ảnh đại diện',
    `address` VARCHAR(255) NULL COMMENT 'Địa chỉ liên hệ',
    `gender` ENUM('male', 'female', 'other') NULL COMMENT 'Giới tính (để nhân viên xưng hô phù hợp)',
    `birth_year` SMALLINT NULL COMMENT 'Năm sinh (để nhân viên xưng hô phù hợp)',
    `status` ENUM('active', 'inactive', 'locked') DEFAULT 'active' COMMENT 'Trạng thái hoạt động tài khoản',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng thông tin tài khoản người dùng';

CREATE INDEX `idx_users_email` ON `users` (`email`);
CREATE INDEX `idx_users_phone` ON `users` (`phone`);
CREATE INDEX `idx_users_status` ON `users` (`status`);

-- ====================================================================
-- 2. PHÂN HỆ HỒ SƠ THÚ CƯNG (F05 - F06)
-- ====================================================================

-- Bảng hồ sơ thú cưng (Pets)
CREATE TABLE `pets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_id` INT NOT NULL COMMENT 'FK liên kết tới users(id) - chủ thú cưng',
    `name` VARCHAR(100) NOT NULL COMMENT 'Tên thú cưng',
    `species` ENUM('dog', 'cat', 'other') NOT NULL DEFAULT 'dog' COMMENT 'Loài: Chó, Mèo, Khác',
    `breed` VARCHAR(100) NULL COMMENT 'Giống loài cụ thể (Poodle, Golden, Mèo Anh lông ngắn...)',
    `gender` ENUM('male', 'female', 'unknown') DEFAULT 'unknown' COMMENT 'Giới tính thú cưng',
    `age_months` INT NULL COMMENT 'Tuổi tính theo tháng',
    `birth_month` DATE NULL COMMENT 'Tháng sinh (lưu ngày 01); tuổi được tự tính từ cột này',
    `weight_kg` DECIMAL(5, 2) NULL COMMENT 'Cân nặng (kg) hỗ trợ tính giá/chọn liều lượng dịch vụ',
    `special_notes` TEXT NULL COMMENT 'Lưu ý sức khỏe, dị ứng thuốc, tính khí, thói quen',
    `avatar_url` VARCHAR(255) NULL COMMENT 'Hình ảnh thú cưng',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'Trạng thái theo dõi',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_pets_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng hồ sơ thú cưng thuộc sở hữu của khách hàng';

CREATE INDEX `idx_pets_customer` ON `pets` (`customer_id`);

-- ====================================================================
-- 3. PHÂN HỆ DỊCH VỤ VÀ NHÂN SỰ (F07 - F09)
-- ====================================================================

-- Bảng danh mục dịch vụ Spa (Services)
CREATE TABLE `services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(150) NOT NULL COMMENT 'Tên dịch vụ (VD: Tắm sấy vệ sinh, Cắt tỉa lông tạo kiểu...)',
    `description` TEXT NULL COMMENT 'Mô tả chi tiết các bước trong quy trình dịch vụ',
    `price` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Giá niêm yết tham khảo (VND)',
    `duration_minutes` INT NOT NULL DEFAULT 60 COMMENT 'Thời lượng dự kiến hoàn thành (phút) dùng để tính khung giờ trùng lịch',
    `image_url` VARCHAR(255) NULL COMMENT 'Ảnh minh họa dịch vụ',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Cờ ẩn/hiện dịch vụ đối với khách hàng',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Bảng danh mục dịch vụ spa thú cưng';

CREATE INDEX `idx_services_active` ON `services` (`is_active`);

-- Bảng hồ sơ nhân viên (Employees)
CREATE TABLE `employees` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL UNIQUE COMMENT 'FK liên kết 1-1 tới bảng users(id)',
    `specialty` VARCHAR(150) NULL COMMENT 'Chuyên môn chính (Tắm vệ sinh, Cắt tỉa Grooming, Trị liệu da lông)',
    `experience_years` DECIMAL(3, 1) DEFAULT 1.0 COMMENT 'Số năm kinh nghiệm',
    `hire_date` DATE NOT NULL COMMENT 'Ngày bắt đầu làm việc',
    `status` ENUM('active', 'on_leave', 'resigned') DEFAULT 'active' COMMENT 'Trạng thái nhân sự',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_employees_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng mở rộng thông tin nhân viên spa';

-- Bảng định nghĩa khung ca làm việc (Shifts)
CREATE TABLE `shifts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `shift_name` VARCHAR(50) NOT NULL COMMENT 'Tên ca: Ca sáng, Ca chiều, Ca tối',
    `start_time` TIME NOT NULL COMMENT 'Giờ bắt đầu ca (VD: 08:00:00)',
    `end_time` TIME NOT NULL COMMENT 'Giờ kết thúc ca (VD: 13:00:00)',
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Bảng các khung ca làm việc chuẩn trong ngày';

-- Bảng phân công ca làm việc cho nhân viên (Employee Shifts)
CREATE TABLE `employee_shifts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `employee_id` INT NOT NULL COMMENT 'FK liên kết tới employees(id)',
    `shift_id` INT NOT NULL COMMENT 'FK liên kết tới shifts(id)',
    `work_date` DATE NOT NULL COMMENT 'Ngày làm việc cụ thể',
    `status` ENUM('scheduled', 'completed', 'absent') DEFAULT 'scheduled' COMMENT 'Trạng thái đi làm',
    `notes` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_emp_shifts_emp` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_emp_shifts_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `uq_emp_shift_date` UNIQUE (`employee_id`, `shift_id`, `work_date`)
) ENGINE=InnoDB COMMENT='Bảng lịch phân ca hàng ngày của từng nhân viên';

CREATE INDEX `idx_emp_shifts_date` ON `employee_shifts` (`work_date`);

-- ====================================================================
-- 4. PHÂN HỆ ĐẶT LỊCH VÀ PHÂN CÔNG (F10 - F15)
-- ====================================================================

-- Bảng lịch hẹn Spa (Appointments)
CREATE TABLE `appointments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_code` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Mã lịch hẹn hiển thị (VD: APT-20261023-001)',
    `customer_id` INT NOT NULL COMMENT 'FK người đặt lịch users(id)',
    `pet_id` INT NOT NULL COMMENT 'FK thú cưng được chăm sóc pets(id)',
    `employee_id` INT NULL COMMENT 'FK kỹ thuật viên/nhân viên phụ trách employees(id) (có thể gán sau)',
    `appointment_date` DATE NOT NULL COMMENT 'Ngày thực hiện hẹn',
    `start_time` TIME NOT NULL COMMENT 'Giờ bắt đầu hẹn',
    `end_time` TIME NOT NULL COMMENT 'Giờ kết thúc dự kiến (tính từ tổng thời lượng dịch vụ)',
    `status` ENUM('pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending' COMMENT 'Quy trình trạng thái lịch hẹn',
    `cancellation_reason` VARCHAR(255) NULL COMMENT 'Lý do hủy lịch nếu khách hoặc nhân viên hủy',
    `customer_notes` TEXT NULL COMMENT 'Ghi chú yêu cầu từ phía khách hàng',
    `staff_notes` TEXT NULL COMMENT 'Ghi chú nội bộ của nhân viên tiếp nhận/quản trị',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_apt_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_apt_pet` FOREIGN KEY (`pet_id`) REFERENCES `pets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_apt_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng thông tin các lịch hẹn chăm sóc thú cưng';

-- Chỉ mục hỗ trợ thuật toán kiểm tra trùng lịch (F12) và tra cứu nhanh
CREATE INDEX `idx_apt_schedule` ON `appointments` (`appointment_date`, `start_time`, `end_time`, `status`);
CREATE INDEX `idx_apt_employee_time` ON `appointments` (`employee_id`, `appointment_date`, `start_time`, `end_time`);
CREATE INDEX `idx_apt_customer` ON `appointments` (`customer_id`);
CREATE INDEX `idx_apt_status` ON `appointments` (`status`);

-- Bảng chi tiết dịch vụ trong từng lịch hẹn (Appointment Details)
CREATE TABLE `appointment_details` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_id` INT NOT NULL COMMENT 'FK liên kết tới appointments(id)',
    `service_id` INT NOT NULL COMMENT 'FK liên kết tới services(id)',
    `price_at_booking` DECIMAL(12, 2) NOT NULL COMMENT 'Giá dịch vụ tại thời điểm đặt (tránh bị đổi khi sửa bảng giá)',
    `duration_minutes` INT NOT NULL COMMENT 'Thời lượng dịch vụ tại thời điểm đặt',
    CONSTRAINT `fk_aptd_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_aptd_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng chi tiết các dịch vụ khách hàng lựa chọn trong một lịch hẹn';

-- Bảng lịch sử chăm sóc và nhật ký sức khỏe thú cưng (F06, F17)
CREATE TABLE `pet_care_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `pet_id` INT NOT NULL COMMENT 'FK thú cưng pets(id)',
    `appointment_id` INT NOT NULL UNIQUE COMMENT 'FK lịch hẹn tương ứng appointments(id)',
    `employee_id` INT NOT NULL COMMENT 'FK nhân viên trực tiếp thực hiện employees(id)',
    `service_date` DATE NOT NULL COMMENT 'Ngày thực hiện dịch vụ',
    `initial_health_notes` TEXT NULL COMMENT 'Tình trạng ban đầu khi tiếp nhận (F16: ve rận, trầy xước, nấm...)',
    `treatment_notes` TEXT NULL COMMENT 'Quá trình thực hiện và phản ứng của bé (F17)',
    `recommendations` TEXT NULL COMMENT 'Lời khuyên chăm sóc tại nhà sau khi về',
    `photo_before_url` VARCHAR(255) NULL COMMENT 'Ảnh thú cưng trước khi làm',
    `photo_after_url` VARCHAR(255) NULL COMMENT 'Ảnh thú cưng sau khi hoàn thành',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_care_pet` FOREIGN KEY (`pet_id`) REFERENCES `pets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_care_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_care_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng nhật ký lịch sử chăm sóc thú cưng sau mỗi lần sử dụng dịch vụ';

-- ====================================================================
-- 5. PHÂN HỆ VẬN HÀNH VÀ THANH TOÁN (F18 - F20)
-- ====================================================================

-- Bảng hóa đơn dịch vụ (Invoices)
CREATE TABLE `invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_code` VARCHAR(30) NOT NULL UNIQUE COMMENT 'Mã hóa đơn chuẩn (VD: INV-20261023-001)',
    `appointment_id` INT NOT NULL UNIQUE COMMENT 'FK lịch hẹn appointments(id) (Mỗi lịch hẹn tạo 1 hóa đơn chính)',
    `customer_id` INT NOT NULL COMMENT 'FK khách hàng users(id)',
    `created_by` INT NOT NULL COMMENT 'FK nhân viên hoặc admin lập hóa đơn users(id)',
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng tiền dịch vụ trước giảm giá (tính tại server)',
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Số tiền giảm giá (khuyến mãi, voucher)',
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Thuế VAT (nếu có)',
    `total_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 COMMENT 'Tổng tiền thực tế phải thanh toán (tính tại server)',
    `payment_status` ENUM('unpaid', 'paid', 'refunded') DEFAULT 'unpaid' COMMENT 'Trạng thái thanh toán',
    `notes` TEXT NULL COMMENT 'Ghi chú thêm trên hóa đơn',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_inv_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_customer` FOREIGN KEY (`customer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng hóa đơn thanh toán dịch vụ spa';

CREATE INDEX `idx_inv_status` ON `invoices` (`payment_status`);
CREATE INDEX `idx_inv_created_at` ON `invoices` (`created_at`);

-- Bảng dòng chi tiết hóa đơn (Invoice Details)
CREATE TABLE `invoice_details` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` INT NOT NULL COMMENT 'FK liên kết tới invoices(id)',
    `service_id` INT NULL COMMENT 'FK liên kết tới services(id) (NULL nếu là phụ thu tùy chỉnh)',
    `item_name` VARCHAR(150) NOT NULL COMMENT 'Tên mục (tên dịch vụ hoặc phụ phí gỡ rối lông, phụ thu tết...)',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT 'Số lượng',
    `unit_price` DECIMAL(12, 2) NOT NULL COMMENT 'Đơn giá',
    `total_price` DECIMAL(12, 2) NOT NULL COMMENT 'Thành tiền = quantity * unit_price',
    CONSTRAINT `fk_invd_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_invd_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng chi tiết các hạng mục tính phí trên từng hóa đơn';

-- Bảng giao dịch thanh toán (Payments) - Mô phỏng thanh toán (F19)
CREATE TABLE `payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` INT NOT NULL COMMENT 'FK liên kết tới invoices(id)',
    `payment_code` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã tham chiếu thanh toán (VD: PAY-20261023-001)',
    `amount` DECIMAL(12, 2) NOT NULL COMMENT 'Số tiền thanh toán',
    `payment_method` ENUM('cash', 'bank_transfer', 'momo_simulated', 'card') NOT NULL DEFAULT 'cash' COMMENT 'Hình thức thanh toán',
    `payment_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Thời điểm ghi nhận tiền vào hệ thống',
    `status` ENUM('success', 'failed', 'pending') DEFAULT 'success' COMMENT 'Trạng thái giao dịch thanh toán',
    `processed_by` INT NOT NULL COMMENT 'FK nhân viên/admin nhận thanh toán users(id)',
    `notes` VARCHAR(255) NULL,
    CONSTRAINT `fk_pay_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_pay_processed_by` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng lịch sử các lượt giao dịch thanh toán (mô phỏng hoặc thực tế)';

-- ====================================================================
-- 6. PHÂN HỆ QUẢN TRỊ, SỰ CỐ VÀ NHẬT KÝ HỆ THỐNG (F21 - F23)
-- ====================================================================

-- Bảng ghi nhận sự cố trong quá trình phục vụ (Incidents)
CREATE TABLE `incidents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `appointment_id` INT NULL COMMENT 'FK lịch hẹn liên quan (nếu có)',
    `pet_id` INT NOT NULL COMMENT 'FK thú cưng gặp sự cố pets(id)',
    `reported_by` INT NOT NULL COMMENT 'FK người báo cáo sự cố users(id)',
    `title` VARCHAR(200) NOT NULL COMMENT 'Tiêu đề sự cố ngắn gọn',
    `incident_type` ENUM('injury', 'allergic_reaction', 'behavioral_aggression', 'service_delay', 'equipment_damage', 'other') NOT NULL,
    `severity` ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low' COMMENT 'Mức độ nghiêm trọng',
    `description` TEXT NOT NULL COMMENT 'Mô tả chi tiết diễn biến sự cố',
    `resolution` TEXT NULL COMMENT 'Biện pháp khắc phục và xử lý',
    `status` ENUM('open', 'investigating', 'resolved') DEFAULT 'open' COMMENT 'Trạng thái xử lý sự cố',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `resolved_at` TIMESTAMP NULL,
    CONSTRAINT `fk_inc_appointment` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT `fk_inc_pet` FOREIGN KEY (`pet_id`) REFERENCES `pets` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `fk_inc_reporter` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng ghi nhận sự cố liên quan đến thú cưng hoặc quá trình vận hành (F23)';

-- Bảng nhật ký thao tác kiểm toán hệ thống (System Logs / Audit Trail)
CREATE TABLE `system_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL COMMENT 'FK người thực hiện thao tác (NULL nếu do cron/hệ thống tự động)',
    `action` VARCHAR(100) NOT NULL COMMENT 'Tên hành động: CREATE_APPOINTMENT, CANCEL_APPOINTMENT, ASSIGN_STAFF, UPDATE_INVOICE...',
    `entity_name` VARCHAR(50) NOT NULL COMMENT 'Tên bảng bị tác động: appointments, invoices, users...',
    `entity_id` INT NULL COMMENT 'ID của bản ghi bị tác động',
    `old_values` JSON NULL COMMENT 'Dữ liệu trước khi sửa đổi (JSON snapshot)',
    `new_values` JSON NULL COMMENT 'Dữ liệu sau khi sửa đổi (JSON snapshot)',
    `ip_address` VARCHAR(45) NULL COMMENT 'Địa chỉ IPv4/IPv6 client',
    `user_agent` VARCHAR(255) NULL COMMENT 'Trình duyệt / Thiết bị client',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_log_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB COMMENT='Bảng nhật ký kiểm toán lưu vết các thao tác quan trọng của quản trị viên/nhân viên (F23)';

CREATE INDEX `idx_logs_action` ON `system_logs` (`action`);
CREATE INDEX `idx_logs_entity` ON `system_logs` (`entity_name`, `entity_id`);
CREATE INDEX `idx_logs_created_at` ON `system_logs` (`created_at`);
