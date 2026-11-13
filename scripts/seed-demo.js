import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { getVietnamDate } from '../src/utils/businessDate.js';
import { assertSeedDatabaseIsEmpty } from './dbSafety.js';

const PASSWORD_DEMO = 'Password123@';

const seedDemo = async () => {
  let conn;
  let transactionStarted = false;
  try {
    console.log('🚀 [Seed Demo] Chỉ nạp dữ liệu demo vào database có schema đầy đủ và còn trống...');
    conn = await pool.getConnection();
    await conn.beginTransaction();
    transactionStarted = true;
    await assertSeedDatabaseIsEmpty(conn);

    const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);

    // 1. Đảm bảo vai trò
    await conn.query(`
      INSERT INTO roles (id, role_name, display_name, description) VALUES
      (1, 'admin', 'Quản trị viên', 'Toàn quyền quản trị'),
      (2, 'staff', 'Nhân viên Spa', 'Chăm sóc và vận hành'),
      (3, 'customer', 'Khách hàng', 'Đặt lịch spa')
      ON DUPLICATE KEY UPDATE display_name = VALUES(display_name)
    `);

    // 2. Tài khoản mẫu Admin, Staff, Customer
    console.log('👥 [Seed Demo] Tạo tài khoản mẫu...');
    const users = [
      { id: 1, role_id: 1, full_name: 'Nguyễn Quản Trị', email: 'admin@petspa.com', phone: '0901234567' },
      { id: 2, role_id: 2, full_name: 'Trần Kỹ Thuật Viên 1', email: 'staff1@petspa.com', phone: '0912345678' },
      { id: 3, role_id: 2, full_name: 'Lê Groomer Chuyên Nghiệp', email: 'staff2@petspa.com', phone: '0923456789' },
      { id: 4, role_id: 3, full_name: 'Phạm Khách Hàng', email: 'khachhang1@gmail.com', phone: '0934567890' },
      { id: 5, role_id: 3, full_name: 'Vũ Thị Sen', email: 'khachhang2@gmail.com', phone: '0945678901' },
    ];

    for (const u of users) {
      await conn.query(
        `INSERT INTO users (id, role_id, full_name, email, phone, password_hash, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), password_hash = VALUES(password_hash)`,
        [u.id, u.role_id, u.full_name, u.email, u.phone, passwordHash]
      );
    }

    // 3. Nhân viên & chuyên môn
    console.log('👨‍⚕️ [Seed Demo] Tạo hồ sơ nhân viên...');
    await conn.query(`
      INSERT INTO employees (id, user_id, specialty, experience_years, hire_date, status) VALUES
      (1, 2, 'Tắm sấy & Trị liệu da lông', 3.0, '2023-01-15', 'active'),
      (2, 3, 'Cắt tỉa tạo kiểu dáng Hàn Quốc', 5.0, '2022-06-01', 'active')
      ON DUPLICATE KEY UPDATE specialty = VALUES(specialty)
    `);

    // 4. Danh mục dịch vụ chuẩn
    console.log('✂️ [Seed Demo] Tạo dịch vụ...');
    await conn.query(`
      INSERT INTO services (id, name, description, price, duration_minutes, is_active) VALUES
      (1, 'Tắm sấy vệ sinh cơ bản', 'Làm sạch sâu da lông, vắt tuyến hôi, sấy phồng và chải tơ lông', 180000.00, 45, 1),
      (2, 'Cắt tỉa tạo kiểu Grooming', 'Cắt tỉa lông nghệ thuật theo chuẩn giống loài và tạo form mặt tròn', 350000.00, 75, 1),
      (3, 'Combo Spa toàn diện VIP', 'Tắm thảo dược, tỉa lông, cắt mài móng, vệ sinh tai mắt, dưỡng serum', 480000.00, 90, 1),
      (4, 'Trị liệu phục hồi da lông', 'Ngâm bồn sục Ozone trị nấm ngứa, phục hồi lông khô xơ', 250000.00, 60, 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price)
    `);

    // 5. Thú cưng mẫu
    console.log('🐶 [Seed Demo] Tạo thú cưng...');
    await conn.query(`
      INSERT INTO pets (id, customer_id, name, species, breed, gender, weight_kg) VALUES
      (1, 4, 'Bông Xù', 'dog', 'Poodle Tiny', 'male', 3.2),
      (2, 4, 'Milo', 'dog', 'Golden Retriever', 'male', 28.5),
      (3, 5, 'Miu Miu', 'cat', 'Mèo Anh lông ngắn', 'female', 4.5)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    // 6. Ca làm việc hôm nay
    console.log('⏰ [Seed Demo] Tạo ca làm việc...');
    await conn.query(`
      INSERT INTO shifts (id, shift_name, start_time, end_time, is_active) VALUES
      (1, 'Ca sáng', '08:00:00', '13:00:00', 1),
      (2, 'Ca chiều', '13:00:00', '18:00:00', 1)
      ON DUPLICATE KEY UPDATE shift_name = VALUES(shift_name)
    `);

    const today = getVietnamDate();
    await conn.query(`
      INSERT INTO employee_shifts (employee_id, shift_id, work_date, status) VALUES
      (1, 1, ?, 'scheduled'),
      (2, 2, ?, 'scheduled')
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `, [today, today]);

    // 7. Lịch hẹn ở các trạng thái khác nhau
    console.log('📅 [Seed Demo] Tạo lịch hẹn ở các trạng thái...');
    await conn.query(`
      INSERT INTO appointments (id, appointment_code, customer_id, pet_id, employee_id, appointment_date, start_time, end_time, status) VALUES
      (1, 'APT-DEMO-001', 4, 1, 1, ?, '08:30:00', '09:15:00', 'completed'),
      (2, 'APT-DEMO-002', 4, 2, 1, ?, '09:30:00', '10:45:00', 'in_progress'),
      (3, 'APT-DEMO-003', 5, 3, 2, ?, '13:30:00', '14:45:00', 'checked_in'),
      (4, 'APT-DEMO-004', 5, 3, 2, ?, '15:00:00', '16:00:00', 'confirmed')
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `, [today, today, today, today]);

    // 8. Hóa đơn mẫu & thanh toán
    console.log('🧾 [Seed Demo] Tạo hóa đơn mẫu...');
    await conn.query(`
      INSERT INTO invoices (id, invoice_code, appointment_id, customer_id, created_by, subtotal, total_amount, payment_status, updated_at) VALUES
      (1, 'INV-DEMO-001', 1, 4, 2, 180000.00, 180000.00, 'paid', NOW()),
      (2, 'INV-DEMO-002', 2, 4, 2, 350000.00, 350000.00, 'unpaid', NOW())
      ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status)
    `);

    // 9. Sự cố mẫu
    console.log('⚠️ [Seed Demo] Tạo sự cố mẫu...');
    await conn.query(`
      INSERT INTO incidents (id, appointment_id, pet_id, reported_by, title, incident_type, severity, description, status) VALUES
      (1, 2, 2, 2, 'Bé Milo hơi hoảng sợ khi sấy lông', 'behavioral_aggression', 'low', 'Bé có phản ứng cắn nhẹ vào vòi sấy khí, nhân viên đã đổi sang chế độ gió êm và vuốt ve trấn an.', 'open')
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `);

    // 10. Thông báo mẫu
    console.log('🔔 [Seed Demo] Tạo thông báo mẫu...');
    await conn.query(`
      INSERT INTO notifications (user_id, type, payload) VALUES
      (4, 'appointment_confirmed', '{"title": "Lịch hẹn đã được xác nhận", "message": "Lịch hẹn chăm sóc bé Bông Xù lúc 08:30 hôm nay đã được xác nhận.", "link": "appointments"}'),
      (4, 'appointment_completed', '{"title": "Hoàn tất dịch vụ", "message": "Bé Bông Xù đã được chăm sóc hoàn tất! Bạn có thể xem sổ tay chăm sóc.", "link": "care-book"}'),
      (5, 'new_invoice', '{"title": "Hóa đơn dịch vụ mới", "message": "Hóa đơn cho bé Miu Miu đã được lập, vui lòng kiểm tra.", "link": "appointments"}')
    `);

    await conn.commit();
    transactionStarted = false;
    console.log('🎉 [Seed Demo] Nạp dữ liệu demo thành công! Mật khẩu cho mọi tài khoản là: Password123@');
    return true;
  } catch (err) {
    if (conn && transactionStarted) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error('❌ [Seed Demo] Không thể rollback transaction:', rollbackError);
      }
    }
    console.error('❌ [Seed Demo] Lỗi khi nạp dữ liệu:', err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemo()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

export default seedDemo;
