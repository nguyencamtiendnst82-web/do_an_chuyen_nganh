const { z } = require('zod');

// Regex số điện thoại VN: 10 số, bắt đầu 0
const phoneRegex = /^0\d{9}$/;

// Regex mật khẩu: tối thiểu 8 ký tự, phải có ít nhất 1 chữ cái và 1 chữ số
const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

const registerSchema = z.object({
  full_name: z.string({ required_error: 'Họ và tên là bắt buộc' })
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ và tên tối đa 100 ký tự')
    .trim(),

  email: z.string({ required_error: 'Email là bắt buộc' })
    .email('Email không hợp lệ')
    .max(150, 'Email tối đa 150 ký tự')
    .toLowerCase(),

  phone: z.string({ required_error: 'Số điện thoại là bắt buộc' })
    .regex(phoneRegex, 'Số điện thoại phải là 10 chữ số và bắt đầu bằng 0'),

  password: z.string({ required_error: 'Mật khẩu là bắt buộc' })
    .regex(passwordRegex, 'Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số'),

  // Các trường sau bị bỏ qua hoàn toàn dù client có gửi lên
  // role_id, role_name, password_hash đều KHÔNG được nhận
});

const loginSchema = z.object({
  credential: z.string({ required_error: 'Email hoặc số điện thoại là bắt buộc' })
    .min(1, 'Email hoặc số điện thoại không được để trống'),

  password: z.string({ required_error: 'Mật khẩu là bắt buộc' })
    .min(1, 'Mật khẩu không được để trống'),
});

const updateMeSchema = z.object({
  full_name: z.string()
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ và tên tối đa 100 ký tự')
    .trim()
    .optional(),

  phone: z.string()
    .regex(phoneRegex, 'Số điện thoại phải là 10 chữ số và bắt đầu bằng 0')
    .optional(),

  address: z.string()
    .max(255, 'Địa chỉ tối đa 255 ký tự')
    .trim()
    .optional()
    .nullable(),

  avatar_url: z.string()
    .url('URL ảnh đại diện không hợp lệ')
    .max(255, 'URL tối đa 255 ký tự')
    .optional()
    .nullable(),
}).strict(); // Từ chối các trường không khai báo (bao gồm role_id, email)

const changePasswordSchema = z.object({
  old_password: z.string({ required_error: 'Mật khẩu cũ là bắt buộc' })
    .min(1, 'Mật khẩu cũ không được để trống'),

  new_password: z.string({ required_error: 'Mật khẩu mới là bắt buộc' })
    .regex(passwordRegex, 'Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ cái và chữ số'),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateMeSchema,
  changePasswordSchema,
};
