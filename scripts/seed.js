import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';
import { assertSeedDatabaseIsEmpty } from './dbSafety.js';

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatCodeDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const seedDatabase = async () => {
  let connection;
  let transactionStarted = false;
  try {
    console.log('🌱 [Seed] Bắt đầu nạp dữ liệu mẫu vào CSDL...');
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    // Chỉ seed database có đủ schema và tất cả bảng nghiệp vụ đang rỗng.
    await assertSeedDatabaseIsEmpty(connection);

    // 1. Thêm Vai trò chuẩn (Roles)
    console.log('📌 [Seed] Đang chèn Roles...');
    await connection.query(`
      INSERT INTO \`roles\` (\`id\`, \`role_name\`, \`display_name\`, \`description\`) VALUES
      (1, 'admin', 'Quản trị viên', 'Toàn quyền quản trị hệ thống, báo cáo, tài khoản, nhân sự và cấu hình'),
      (2, 'staff', 'Nhân viên Spa', 'Tiếp nhận thú cưng, cập nhật tiến độ, chăm sóc và lập hóa đơn'),
      (3, 'customer', 'Khách hàng', 'Đặt lịch hẹn, quản lý hồ sơ thú cưng, xem lịch sử và hóa đơn')
    `);

    // 3. Băm mật khẩu động cho "Password123@" bằng bcryptjs (cost 10)
    console.log('🔐 [Seed] Đang băm mật khẩu Password123@ bằng bcryptjs...');
    const passwordHash = await bcrypt.hash('Password123@', 10);

    // 4. Thêm Người dùng mẫu (Users)
    console.log('📌 [Seed] Đang chèn Users...');
    await connection.query(`
      INSERT INTO \`users\` (\`id\`, \`role_id\`, \`full_name\`, \`email\`, \`phone\`, \`password_hash\`, \`address\`, \`status\`) VALUES
      (1, 1, 'Nguyễn Quản Trị', 'admin@petspa.com', '0901234567', ?, '123 Nguyễn Thị Minh Khai, Q1, TP.HCM', 'active'),
      (2, 2, 'Trần Kỹ Thuật Viên 1', 'staff1@petspa.com', '0912345678', ?, '456 Lê Lợi, Q3, TP.HCM', 'active'),
      (3, 2, 'Lê Groomer Chuyên Nghiệp', 'staff2@petspa.com', '0923456789', ?, '789 CMT8, Q10, TP.HCM', 'active'),
      (4, 3, 'Phạm Khách Hàng', 'khachhang1@gmail.com', '0934567890', ?, '12 Điện Biên Phủ, Bình Thạnh, TP.HCM', 'active'),
      (5, 3, 'Vũ Thị Sen', 'khachhang2@gmail.com', '0945678901', ?, '34 Hai Bà Trưng, Q1, TP.HCM', 'active')
    `, [passwordHash, passwordHash, passwordHash, passwordHash, passwordHash]);

    // 5. Thêm Thông tin Nhân viên mở rộng (Employees)
    console.log('📌 [Seed] Đang chèn Employees...');
    await connection.query(`
      INSERT INTO \`employees\` (\`id\`, \`user_id\`, \`specialty\`, \`experience_years\`, \`hire_date\`, \`status\`) VALUES
      (1, 2, 'Tắm vệ sinh & Trị liệu da lông mẫn cảm', 2.5, '2025-01-15', 'active'),
      (2, 3, 'Grooming cắt tỉa tạo kiểu dáng Hàn Quốc & Nhuộm lông nghệ thuật', 4.0, '2024-06-01', 'active')
    `);

    // 6. Thêm Hồ sơ Thú cưng (Pets)
    console.log('📌 [Seed] Đang chèn Pets...');
    await connection.query(`
      INSERT INTO \`pets\` (\`id\`, \`customer_id\`, \`name\`, \`species\`, \`breed\`, \`gender\`, \`age_months\`, \`weight_kg\`, \`special_notes\`) VALUES
      (1, 4, 'Bông Xù', 'dog', 'Poodle Tiny', 'female', 18, 3.20, 'Bé rất nhát nước, tai dễ bị viêm cần sấy thật khô, thích ăn bánh thưởng gà'),
      (2, 4, 'Milo', 'dog', 'Golden Retriever', 'male', 24, 28.50, 'Thân thiện, ham chơi, cần chải bớt lông rụng kỹ'),
      (3, 5, 'Miu Miu', 'cat', 'Mèo Anh Lông Ngắn', 'female', 12, 4.10, 'Sợ máy sấy lớn kêu to, dễ quạu khi cắt móng, cần 2 người hỗ trợ')
    `);

    // 7. Thêm Danh mục Dịch vụ Spa (Services)
    console.log('📌 [Seed] Đang chèn Services...');
    await connection.query(`
      INSERT INTO \`services\` (\`id\`, \`name\`, \`description\`, \`price\`, \`duration_minutes\`, \`is_active\`) VALUES
      (1, 'Combo Tắm Sấy & Vệ Sinh Toàn Diện', 'Bao gồm: Cắt dũa móng, vệ sinh tai kẽ chân, vắt tuyến hôi, tắm 2 lần sữa tắm dưỡng lông, sấy phồng và xịt nước hoa thơm lâu', 200000.00, 60, TRUE),
      (2, 'Cắt Tỉa Lông Tạo Kiểu Trọn Gói', 'Bao gồm gói combo tắm sấy vệ sinh + Cắt tỉa tạo form mặt tròn Teddy/Gấu bông/Hàn Quốc theo yêu cầu', 350000.00, 90, TRUE),
      (3, 'Cạo Lông / Vệ Sinh Bụng Mông Gọn Gàng', 'Cạo lông đệm chân, bụng và hậu môn giúp giữ vệ sinh sạch sẽ', 120000.00, 30, TRUE),
      (4, 'Tắm Bùn Khoáng / Thảo Dược Trị Liệu Da', 'Liệu trình giảm ngứa, phục hồi da nấm vảy gàu bằng bùn khoáng thiên nhiên Nhật Bản', 280000.00, 60, TRUE),
      (5, 'Gỡ Rối Lông Chuyên Sâu (Tính theo giờ)', 'Gỡ rối bằng xịt chuyên dụng và lược kim không làm đứt lông của bé', 150000.00, 45, TRUE)
    `);

    // 8. Thêm Khung Ca Làm Việc (Shifts)
    console.log('📌 [Seed] Đang chèn Shifts...');
    await connection.query(`
      INSERT INTO \`shifts\` (\`id\`, \`shift_name\`, \`start_time\`, \`end_time\`, \`description\`) VALUES
      (1, 'Ca Sáng', '08:00:00', '13:00:00', 'Ca sáng phục vụ các bé đặt lịch sớm'),
      (2, 'Ca Chiều', '13:00:00', '18:00:00', 'Ca chiều cao điểm spa và grooming'),
      (3, 'Ca Tối', '18:00:00', '21:00:00', 'Ca phụ vụ khách hàng sau giờ hành chính')
    `);

    // 9. Phân ca tự động cho 30 ngày (bỏ Chủ nhật) cho cả 2 nhân viên
    console.log('📅 [Seed] Đang tự động sinh ca làm việc (Employee Shifts) cho 30 ngày...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Tính ngày cho 3 lịch hẹn mẫu: Hôm qua, Hôm nay, Ngày mai
    let datePast = new Date(today);
    datePast.setDate(today.getDate() - 1);
    if (datePast.getDay() === 0) {
      // Nếu hôm qua là Chủ nhật, lùi thêm 1 ngày về Thứ bảy để rơi vào ca làm việc
      datePast.setDate(datePast.getDate() - 1);
    }

    let datePresent = new Date(today);
    if (datePresent.getDay() === 0) {
      // Nếu hôm nay là Chủ nhật, dời sang Thứ hai
      datePresent.setDate(datePresent.getDate() + 1);
    }

    let dateFuture = new Date(today);
    dateFuture.setDate(today.getDate() + 1);
    if (dateFuture.getDay() === 0) {
      // Nếu ngày mai là Chủ nhật, tiến thêm 1 ngày sang Thứ hai
      dateFuture.setDate(dateFuture.getDate() + 1);
    }

    // Danh sách các ngày cần gán ca: bao gồm ngày quá khứ datePast và 30 ngày từ today
    const shiftDateSet = new Set();
    shiftDateSet.add(formatDate(datePast));

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      // Bỏ Chủ nhật
      if (d.getDay() !== 0) {
        shiftDateSet.add(formatDate(d));
      }
    }

    const shiftValues = [];
    const todayStr = formatDate(today);

    for (const workDate of shiftDateSet) {
      const status = workDate < todayStr ? 'completed' : 'scheduled';
      // Phân ca 1 (Ca Sáng: 08:00 - 13:00) và ca 2 (Ca Chiều: 13:00 - 18:00) cho cả NV1 và NV2
      shiftValues.push([1, 1, workDate, status, 'Ca sáng chuẩn']);
      shiftValues.push([1, 2, workDate, status, 'Ca chiều chuẩn']);
      shiftValues.push([2, 1, workDate, status, 'Ca sáng chuẩn']);
      shiftValues.push([2, 2, workDate, status, 'Ca chiều chuẩn']);
    }

    for (const sv of shiftValues) {
      await connection.query(`
        INSERT INTO \`employee_shifts\` (\`employee_id\`, \`shift_id\`, \`work_date\`, \`status\`, \`notes\`)
        VALUES (?, ?, ?, ?, ?)
      `, sv);
    }

    // 10. Thêm 3 Lịch hẹn mẫu nhất quán với ca làm việc
    console.log('📌 [Seed] Đang chèn 3 Lịch hẹn mẫu (Appointments)...');
    const pastStr = formatDate(datePast);
    const presentStr = formatDate(datePresent);
    const futureStr = formatDate(dateFuture);

    const pastCode = `APT-${formatCodeDate(datePast)}-001`;
    const presentCode = `APT-${formatCodeDate(datePresent)}-002`;
    const futureCode = `APT-${formatCodeDate(dateFuture)}-001`;

    await connection.query(`
      INSERT INTO \`appointments\` (\`id\`, \`appointment_code\`, \`customer_id\`, \`pet_id\`, \`employee_id\`, \`appointment_date\`, \`start_time\`, \`end_time\`, \`status\`, \`customer_notes\`, \`staff_notes\`) VALUES
      (1, ?, 4, 1, 2, ?, '09:00:00', '10:30:00', 'completed', 'Nhờ shop tỉa form tròn gấu bông cho bé nhé', 'Bé hợp tác tốt, đã cắt tỉa xong đẹp'),
      (2, ?, 5, 3, 1, ?, '14:00:00', '15:00:00', 'in_progress', 'Bé hơi nhát nước, nhờ làm nhẹ nhàng', 'Đang thực hiện sấy lồng êm dịu'),
      (3, ?, 4, 2, 1, ?, '09:00:00', '10:00:00', 'confirmed', 'Tắm sạch sẽ và chải lông rụng', 'Đã phân công NV Trần Kỹ Thuật Viên')
    `, [pastCode, pastStr, presentCode, presentStr, futureCode, futureStr]);

    // 11. Chi tiết dịch vụ lịch hẹn
    console.log('📌 [Seed] Đang chèn Appointment Details...');
    await connection.query(`
      INSERT INTO \`appointment_details\` (\`appointment_id\`, \`service_id\`, \`price_at_booking\`, \`duration_minutes\`) VALUES
      (1, 2, 350000.00, 90),
      (2, 1, 200000.00, 60),
      (3, 1, 200000.00, 60)
    `);

    // 12. Nhật ký chăm sóc thú cưng cho lịch hẹn đã hoàn thành (Lịch 1)
    console.log('📌 [Seed] Đang chèn Pet Care History...');
    await connection.query(`
      INSERT INTO \`pet_care_history\` (\`pet_id\`, \`appointment_id\`, \`employee_id\`, \`service_date\`, \`initial_health_notes\`, \`treatment_notes\`, \`recommendations\`) VALUES
      (1, 1, 2, ?, 'Bé sạch sẽ, tai có ít chất bẩn nhẹ, lông rối vùng nách', 'Đã gỡ rối nhẹ nhàng, làm sạch tai kẽ chân, cắt form tròn Teddy', 'Nên chải lông hàng ngày và lau tai bằng dung dịch chuyên dụng 2 ngày/lần')
    `, [pastStr]);

    // 13. Hóa đơn cho lịch hẹn đã hoàn thành
    console.log('📌 [Seed] Đang chèn Invoices & Details...');
    const invCode = `INV-${formatCodeDate(datePast)}-001`;
    await connection.query(`
      INSERT INTO \`invoices\` (\`id\`, \`invoice_code\`, \`appointment_id\`, \`customer_id\`, \`created_by\`, \`subtotal\`, \`discount_amount\`, \`tax_amount\`, \`total_amount\`, \`payment_status\`) VALUES
      (1, ?, 1, 4, 2, 350000.00, 0.00, 0.00, 350000.00, 'paid')
    `, [invCode]);

    await connection.query(`
      INSERT INTO \`invoice_details\` (\`invoice_id\`, \`service_id\`, \`item_name\`, \`quantity\`, \`unit_price\`, \`total_price\`) VALUES
      (1, 2, 'Cắt Tỉa Lông Tạo Kiểu Trọn Gói', 1, 350000.00, 350000.00)
    `);

    // 14. Giao dịch thanh toán mô phỏng (Payment)
    console.log('📌 [Seed] Đang chèn Payments...');
    const payCode = `PAY-${formatCodeDate(datePast)}-001`;
    await connection.query(`
      INSERT INTO \`payments\` (\`invoice_id\`, \`payment_code\`, \`amount\`, \`payment_method\`, \`payment_time\`, \`status\`, \`processed_by\`, \`notes\`) VALUES
      (1, ?, 350000.00, 'bank_transfer', ?, 'success', 2, 'Khách đã quét mã QR chuyển khoản ngân hàng thành công')
    `, [payCode, `${pastStr} 10:35:00`]);

    // 15. Nhật ký kiểm toán hệ thống (System Logs)
    console.log('📌 [Seed] Đang chèn System Logs...');
    await connection.query(`
      INSERT INTO \`system_logs\` (\`user_id\`, \`action\`, \`entity_name\`, \`entity_id\`, \`new_values\`, \`ip_address\`) VALUES
      (1, 'CREATE_APPOINTMENT', 'appointments', 1, ?, '127.0.0.1'),
      (2, 'CHECKOUT_INVOICE', 'invoices', 1, ?, '127.0.0.1')
    `, [
      JSON.stringify({ code: pastCode, pet_name: 'Bông Xù', service: 'Cắt Tỉa Lông' }),
      JSON.stringify({ code: invCode, total: 350000, status: 'paid' })
    ]);

    await connection.commit();
    transactionStarted = false;
    console.log('✅ [Seed] Nạp dữ liệu mẫu thành công hoàn toàn!');
    console.log('ℹ️ [Seed] Mật khẩu test cho TẤT CẢ tài khoản là: Password123@');
    return true;
  } catch (error) {
    if (connection && transactionStarted) {
      await connection.rollback();
    }
    console.error('❌ [Seed] Lỗi khi nạp dữ liệu mẫu:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase()
    .catch(() => {
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

export default seedDatabase;
