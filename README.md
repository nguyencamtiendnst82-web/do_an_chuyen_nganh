# Pet Spa System

Website quản lý và vận hành dịch vụ spa thú cưng (đồ án chuyên ngành).
Backend Node.js/Express + MySQL, frontend React + Vite + Tailwind, kiểm thử Jest + Supertest.

## Cài đặt nhanh

```bash
# 1. Backend
npm install
cp .env.example .env        # điền DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, CLIENT_URL...
npm run init-db             # tạo cơ sở dữ liệu (cần scripts/seed.js để nạp dữ liệu mẫu)
npm run migrate             # áp dụng các migration (nếu có)
npm run dev                 # API chạy tại http://localhost:5000

# 2. Frontend
cd frontend
npm install
cp .env.example .env
npm run dev                 # giao diện tại http://localhost:5173
```

Kiểm thử: `npm test`. Nên trỏ `DB_NAME` sang một database riêng cho test vì các test tạo/xóa dữ liệu.

## Phân quyền theo mô hình spa thực tế

Hệ thống có 3 vai trò. Quyền được kiểm tra ở **máy chủ** (API trả 403 nếu vượt quyền), giao diện chỉ ẩn nút tương ứng.

| Chức năng | Khách hàng | Nhân viên (tiếp tân/groomer) | Quản trị viên (chủ cửa hàng) |
|---|---|---|---|
| Hồ sơ cá nhân, đổi mật khẩu | Của mình | Của mình | Của mình |
| Hồ sơ **thú cưng** | Thêm, sửa, ẩn, đổi ảnh (của mình) | **Chỉ xem** tất cả | **Chỉ xem** tất cả |
| Hồ sơ **khách hàng** | Tự sửa | Chỉ tra cứu để đặt lịch | **Chỉ xem chi tiết** (không sửa, không đặt lại mật khẩu); có thể khóa/mở khóa |
| Đặt lịch, đổi lịch, hủy lịch | Của mình | Đặt hộ khách, đổi/hủy | **Không** (chỉ xem) |
| Xác nhận, phân công, tiếp nhận, bắt đầu, hoàn tất | — | Chỉ lịch được phân công cho mình (kể cả chuyển lịch cho nhân viên khác) | **Không** (chỉ xem) |
| Xem thông tin thú cưng trong chi tiết lịch hẹn | — | Có (chỉ đọc) | Có (chỉ đọc) |
| Lập hóa đơn, ghi nhận thanh toán | Xem hóa đơn của mình | Có (lịch của mình) | Xem hóa đơn |
| Sự cố vận hành | — | Ghi nhận, xem của mình | Xem tất cả, xử lý và đóng sự cố |
| Dịch vụ và bảng giá | Xem | Xem | Tạo, sửa, ẩn/hiện |
| Nhân viên và ca làm việc | Xem đội ngũ | Xem ca của mình | Tạo, sửa, khóa, đặt lại mật khẩu nhân viên; phân ca |
| Báo cáo, dashboard, nhật ký hệ thống | — | Dashboard cá nhân | Toàn quyền xem và xuất CSV |

Ghi chú:
- Bảng tài khoản của admin chia hai tab **Nhân viên** và **Khách hàng**; tài khoản quản trị viên không hiển thị.
- Quản trị viên không có trang chủ công khai: đăng nhập xong vào thẳng `/admin`.
- Thanh điều hướng bên trái (nhân viên, admin) cố định khi cuộn trang.

## Cấu trúc thư mục

```
src/            API: routes → controllers → services → repositories
database/       schema.sql và migrations
scripts/        init-db, migrate, các script migration
tests/          Jest + Supertest
frontend/       React + Vite
docs/           API.md, báo cáo kiểm thử
```

## Tài liệu

- `docs/API.md`: danh sách API và quyền truy cập.
- `docs/BAO_CAO_KIEM_THU.md`: báo cáo kiểm thử.
- `HUONG_DAN_GOOGLE_LOGIN.md`: cấu hình đăng nhập Google.
