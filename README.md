# 🐾 Pet Spa System

Website quản lý và vận hành dịch vụ spa thú cưng (đồ án chuyên ngành).

- **Backend:** Node.js + Express + MySQL (cổng `5000`)
- **Frontend:** React + Vite + Tailwind (cổng `5173`, tự chuyển tiếp `/api` sang backend)
- **Kiểm thử:** Jest + Supertest

---

## 1. Yêu cầu cài đặt trước

| Phần mềm | Ghi chú |
|---|---|
| Node.js (bản LTS) | Kiểm tra: `node -v`, `npm -v` |
| MySQL 8 | Dùng MySQL Server hoặc XAMPP; phải đang chạy |
| Trình duyệt | Chrome / Edge |

---

## 2. Khởi động web (đã có sẵn database)

Dùng cho máy đã cài đặt xong như hướng dẫn mục 3. Mở **2 cửa sổ cmd** và để cả hai chạy.

**Cửa sổ 1 – Backend**
```cmd
cd /d E:\Do_an_chuyen_nganh
npm run dev
```
Thấy hai dòng sau là thành công:
```
✅ [Database] Kết nối MySQL thành công tới database: pet_spa_db
🚀 [Server] Pet Spa API Server đang chạy tại http://localhost:5000
```

**Cửa sổ 2 – Frontend**
```cmd
cd /d E:\Do_an_chuyen_nganh\frontend
npm run dev
```

Mở trình duyệt tại **http://localhost:5173** và đăng nhập bằng tài khoản ở mục 4.

> Nhớ bật MySQL trước khi chạy backend. Nếu backend báo lỗi kết nối, xem mục 8.

---

## 3. Cài đặt lần đầu (máy mới)

**Bước 1 – Cài thư viện**
```cmd
cd /d E:\Do_an_chuyen_nganh
npm install
cd frontend
npm install
cd ..
```

**Bước 2 – Tạo file cấu hình backend:** sao chép `.env.example` thành `.env` rồi điền:
```env
PORT=5000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=mật_khẩu_mysql_của_bạn
DB_NAME=pet_spa_db
JWT_SECRET=một_chuỗi_bí_mật_dài_tự_đặt
JWT_EXPIRES_IN=8h
CLIENT_URL=http://localhost:5173
```
Các mục `SMTP_*` và `GOOGLE_CLIENT_ID` có thể để trống (xem mục 7: khi để trống `SMTP_HOST`, link xác minh in ra cửa sổ backend).

**Bước 3 – Tạo database và dữ liệu mẫu** (chỉ làm một lần, khi database `pet_spa_db` **chưa tồn tại**):
```cmd
npm run init-db
```
Nhập `y` để xác nhận. Lệnh này tạo toàn bộ bảng và nạp dữ liệu mẫu (tài khoản, thú cưng, dịch vụ, ca làm, lịch hẹn, hóa đơn).
Nếu database đã tồn tại, lệnh sẽ **từ chối và không xóa dữ liệu**. Khi đó bỏ qua bước này.

**Bước 4 – (Tùy chọn) Nâng cấp database cũ** nếu bạn đang dùng database tạo từ phiên bản trước và thiếu bảng/cột mới:
```cmd
npm run migrate
```

**Bước 5 – (Tùy chọn) Cấu hình frontend:** sao chép `frontend/.env.example` thành `frontend/.env` nếu muốn dùng đăng nhập Google. Không cần cấu hình địa chỉ API.

Sau đó chạy web theo mục 2.

---

## 4. Tài khoản đăng nhập mẫu

Mật khẩu chung cho **tất cả** tài khoản mẫu: `Password123@`

| Vai trò | Email đăng nhập | Họ tên | Dùng để |
|---|---|---|---|
| Quản trị viên (chủ cửa hàng) | `admin@petspa.com` | Nguyễn Quản Trị | Xem dashboard, báo cáo, nhật ký; quản lý dịch vụ, nhân viên, ca làm; xem khách hàng, thú cưng, lịch hẹn |
| Nhân viên 1 | `staff1@petspa.com` | Trần Kỹ Thuật Viên 1 | Tiếp nhận, chăm sóc, hoàn tất lịch; lập hóa đơn, thanh toán |
| Nhân viên 2 | `staff2@petspa.com` | Lê Groomer Chuyên Nghiệp | Như nhân viên 1 (lịch của mình) |
| Khách hàng 1 | `khachhang1@petspa.com` | Phạm Khách Hàng | Đặt lịch, quản lý thú cưng, xem sổ tay và hóa đơn |
| Khách hàng 2 | `khachhang2@petspa.com` | Vũ Thị Sen | Như khách hàng 1 |

Ghi chú:
- Có thể đăng nhập bằng **email hoặc số điện thoại**.
- Nếu bạn đã đổi mật khẩu một tài khoản trong lúc dùng thử, hãy dùng mật khẩu mới.
- Khách hàng mới tự đăng ký ở trang **Đăng ký**; email cần được xác minh trước khi đặt lịch (xem mục 7).
- Tài khoản nhân viên mới do admin tạo ở **Nhân viên & khách hàng → Thêm nhân viên mới**.

---

## 5. Phân quyền theo mô hình spa thực tế

Quyền được kiểm tra ở **máy chủ** (API trả 403 nếu vượt quyền); giao diện chỉ ẩn các nút tương ứng.

| Chức năng | Khách hàng | Nhân viên | Quản trị viên (chủ cửa hàng) |
|---|---|---|---|
| Hồ sơ cá nhân, đổi mật khẩu | Của mình | Của mình | Của mình |
| Hồ sơ **thú cưng** | Thêm, sửa, ẩn, đổi ảnh (của mình) | **Chỉ xem** tất cả, bấm vào để xem chi tiết và sổ tay | **Chỉ xem** tất cả, xem chi tiết và sổ tay |
| Thông tin **khách hàng** | Tự sửa hồ sơ | Tra cứu để đặt lịch | **Chỉ xem chi tiết**; không sửa, không đặt lại mật khẩu; có thể khóa/mở khóa |
| Thông tin **nhân viên** | — | Tự sửa hồ sơ của mình | **Chỉ xem chi tiết**; không sửa thông tin. Tạo tài khoản, khóa/mở khóa, đặt lại mật khẩu |
| Đặt, đổi, hủy lịch | Của mình | Đặt hộ khách, đổi/hủy | **Không** (chỉ xem) |
| Xác nhận, phân công, tiếp nhận, bắt đầu, hoàn tất | — | Chỉ lịch được phân cho mình | **Không** (chỉ xem) |
| Xem thông tin thú cưng trong chi tiết lịch hẹn | — | Có | Có |
| Hóa đơn, thanh toán | Xem hóa đơn của mình | Lập và ghi nhận thanh toán (lịch của mình) | Xem hóa đơn |
| Sự cố vận hành | — | Ghi nhận, xem của mình | Xem tất cả, xử lý và đóng sự cố |
| Dịch vụ và bảng giá | Xem | Xem | Tạo, sửa, ẩn/hiện |
| Ca làm việc | — | Xem ca của mình | Tạo ca, phân ca |
| Báo cáo, dashboard, nhật ký hệ thống | — | Dashboard cá nhân | Toàn quyền xem, xuất CSV |

Giao diện:
- Bảng tài khoản của admin chia hai tab **Nhân viên** và **Khách hàng**; tài khoản quản trị viên không hiển thị.
- Quản trị viên không có trang chủ công khai: đăng nhập xong vào thẳng `/admin`.
- Thanh điều hướng bên trái (nhân viên, admin) cố định khi cuộn trang.

---

## 6. Gợi ý demo theo luồng

1. **Khách hàng** (`khachhang1@petspa.com`): thêm thú cưng → **Đặt lịch** (chọn dịch vụ, ngày, giờ) → xem trong **Lịch hẹn của tôi**.
2. **Nhân viên** (`staff1@petspa.com`): vào **Lịch hẹn** → bấm **Chi tiết** để xem thông tin thú cưng → **Xác nhận → Tiếp nhận → Bắt đầu → Hoàn tất** (nhập ghi chú chăm sóc, ảnh trước/sau) → **Lập hóa đơn** → **Ghi nhận thanh toán**.
3. **Khách hàng:** xem **Sổ tay chăm sóc**, hóa đơn và thông báo.
4. **Quản trị viên** (`admin@petspa.com`): xem **Dashboard**, **Báo cáo doanh thu**, **Nhật ký hệ thống**, **Hồ sơ thú cưng** (bấm để xem chi tiết), **Nhân viên & khách hàng** (biểu tượng 👁️ xem chi tiết), **Ca làm việc**, **Dịch vụ**.

---

## 7. Tùy chọn nâng cao

### Email xác minh và quên mật khẩu

Hệ thống gửi thư khi **đăng ký** (xác minh email) và **quên mật khẩu**. Có hai cách dùng:

**Cách 1 – Không gửi thư thật (đơn giản nhất khi demo):** để trống `SMTP_HOST` trong `.env`. Nội dung thư và đường link được **in ra cửa sổ chạy backend** (khối `📧 [Mail - chưa cấu hình SMTP...]`). Copy link đó dán vào trình duyệt.

**Cách 2 – Gửi thư thật qua Gmail:**

1. **Bật xác minh 2 bước:** https://myaccount.google.com/security → *Xác minh 2 bước* → bật.
2. **Tạo mật khẩu ứng dụng:** https://myaccount.google.com/apppasswords (chỉ hiện sau khi bật bước 1) → đặt tên `PetSpa` → *Tạo*. Copy chuỗi 16 ký tự và **bỏ dấu cách** (chỉ hiện một lần).
3. **Điền vào `.env`:**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=email_cua_ban@gmail.com
   SMTP_PASS=abcdefghijklmnop
   MAIL_FROM=Pet Spa <email_cua_ban@gmail.com>
   CLIENT_URL=http://localhost:5173
   ```
   `SMTP_PASS` là mật khẩu ứng dụng, **không phải** mật khẩu đăng nhập Gmail. `CLIENT_URL` quyết định đường link trong thư.
4. **Khởi động lại backend** (`Ctrl+C` rồi `npm run dev`). Sửa `.env` chỉ có hiệu lực sau khi khởi động lại.
5. **Thử:** bấm *Quên mật khẩu* hoặc *Đăng ký* bằng một email **thật**, rồi kiểm tra hộp thư (cả **Thư rác** và tab **Quảng cáo**).

**Kiểm tra khi không thấy thư:**

| Dấu hiệu | Ý nghĩa và cách xử lý |
|---|---|
| Cửa sổ backend **có** dòng `❌ [Mail] Không gửi được thư...` | Gửi thất bại, đọc lý do ở cuối dòng và xem bảng bên dưới |
| **Không** có dòng lỗi | Backend đã gửi xong. Mở **Thư đã gửi** của Gmail gửi: có thư là đã gửi, hãy tìm trong Thư rác / Quảng cáo của hộp thư nhận (Yahoo hay đưa thư vào Spam hoặc trễ vài phút). Thử gửi sang một Gmail khác |
| Thấy khối `📧 [Mail - chưa cấu hình SMTP...]` | `SMTP_HOST` đang trống nên thư chỉ in ra console, hãy copy link ở đó |
| Tài khoản đã xác minh rồi | Hệ thống trả thành công nhưng không gửi thêm thư |

| Lý do trong dòng lỗi | Cách sửa |
|---|---|
| `Invalid login` / `535` | Sai `SMTP_USER` hoặc `SMTP_PASS`: dùng đúng mật khẩu ứng dụng 16 ký tự, không có dấu cách |
| `self-signed certificate in certificate chain` | Diệt virus đang quét kết nối mã hóa. Tắt quét SSL trong diệt virus; hoặc **chỉ khi demo** thêm `SMTP_TLS_REJECT_UNAUTHORIZED=false` vào `.env` (xem lưu ý bên dưới) |
| `ETIMEDOUT` / `ECONNREFUSED` | Mạng chặn cổng 587: đổi sang 4G/hotspot, hoặc dùng `SMTP_PORT=465` và `SMTP_SECURE=true` |
| `Chưa cài thư viện nodemailer` | Chạy `npm install nodemailer` ở thư mục gốc rồi chạy lại backend |

Lưu ý:
- `SMTP_TLS_REJECT_UNAUTHORIZED=false` tắt kiểm tra chứng chỉ **chỉ cho việc gửi mail**. Chỉ dùng khi demo trên máy cá nhân, **để trống khi triển khai thật**.
- Gửi thư lỗi **không làm hỏng** thao tác chính: đăng ký vẫn thành công, khách bấm *Gửi lại thư xác minh* sau khi đăng nhập.
- Thư đặt lại mật khẩu không tiết lộ email nào đã đăng ký: email sai thì giao diện vẫn báo "đã gửi". Muốn thử, dùng đúng email của tài khoản.
- 5 tài khoản mẫu (`@petspa.com`) là email giả nên không nhận được thư. Để thử, đăng ký tài khoản mới bằng email thật của bạn.
- Gmail giới hạn khoảng 500 thư mỗi ngày, đủ cho đồ án.
- **Không đưa file `.env` lên GitHub** vì chứa mật khẩu ứng dụng.

### Đăng nhập bằng Google
Xem `HUONG_DAN_GOOGLE_LOGIN.md`. Điền `GOOGLE_CLIENT_ID` ở `.env` và `VITE_GOOGLE_CLIENT_ID` ở `frontend/.env` (cùng một giá trị).

### Kiểm thử và build
```cmd
npm test                      :: kiểm thử backend (mất khoảng 1–2 phút)
cd frontend
npm run lint                  :: kiểm tra mã giao diện
npm run build                 :: build bản production
```
Các test tạo và xóa dữ liệu thử có tiền tố `test_`; **không xóa 5 tài khoản mẫu**. Nên trỏ `DB_NAME` sang một database riêng khi chạy test nếu không muốn đụng dữ liệu đang dùng.

---

## 8. Xử lý lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL chưa chạy. Bật MySQL (hoặc XAMPP) rồi chạy lại backend |
| `ER_ACCESS_DENIED_ERROR` | Sai `DB_USER` / `DB_PASSWORD` trong `.env` |
| `ER_BAD_DB_ERROR` (không có database) | Chưa tạo database: chạy `npm run init-db` (mục 3, bước 3) |
| `init-db` từ chối vì database đã tồn tại | Bình thường, database đã có thì bỏ qua. Cần làm lại từ đầu thì xóa database thủ công trong MySQL rồi chạy lại |
| Web báo lỗi mạng hoặc CORS | Backend chưa chạy, hoặc `CLIENT_URL` trong `.env` không phải `http://localhost:5173` |
| Cổng `5000` hoặc `5173` đã bị dùng | Tắt chương trình đang dùng cổng đó, hoặc đổi `PORT` trong `.env` |
| Đăng ký/quên mật khẩu nhưng không nhận thư | Xem mục 7 (phần email): kiểm tra dòng `❌ [Mail]` ở cửa sổ backend, Thư đã gửi của Gmail gửi, Thư rác |
| `self-signed certificate in certificate chain` khi gửi mail | Tắt quét SSL của diệt virus, hoặc khi demo thêm `SMTP_TLS_REJECT_UNAUTHORIZED=false` vào `.env`, hoặc để trống `SMTP_HOST` cho link in ra console |
| Đăng nhập báo tài khoản/mật khẩu không đúng | Mật khẩu mẫu là `Password123@` (phân biệt hoa thường); kiểm tra tài khoản có bị khóa không |
| Quên mật khẩu nhưng không thấy thư | Xem cửa sổ backend (nếu chưa cấu hình SMTP) hoặc hộp thư rác |

---

## 9. Cấu trúc thư mục

```
src/            API: routes → controllers → services → repositories
database/       schema.sql và migrations
scripts/        init-db, seed, migrate và các script nâng cấp database
tests/          Jest + Supertest
frontend/       React + Vite
docs/           API.md, báo cáo kiểm thử
```

## 10. Tài liệu liên quan

- `docs/API.md`: danh sách API và quyền truy cập.
- `docs/BAO_CAO_KIEM_THU.md`: báo cáo kiểm thử.
- `HUONG_DAN_GOOGLE_LOGIN.md`: cấu hình đăng nhập Google.
