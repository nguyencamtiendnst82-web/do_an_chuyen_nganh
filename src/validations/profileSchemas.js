import { z } from 'zod';

const MIN_YEAR = 1900;
const MIN_AGE = 5; // người dùng tối thiểu 5 tuổi (tránh nhập bừa)

const emptyToNull = (v) => (v === '' ? null : v);

/**
 * Các trường mở rộng của hồ sơ: giới tính và năm sinh (đều không bắt buộc).
 * - Không gửi trường → giữ nguyên giá trị cũ (undefined)
 * - Gửi null hoặc chuỗi rỗng → xóa giá trị
 */
const profileExtraSchema = z.object({
  gender: z.preprocess(
    emptyToNull,
    z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Giới tính không hợp lệ.' }) })
      .nullable()
      .optional()
  ),
  birth_year: z.preprocess(
    (v) => {
      if (v === '' || v === null) return null;
      if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
      return v;
    },
    z.number({ invalid_type_error: 'Năm sinh phải là số.' })
      .int('Năm sinh phải là số nguyên.')
      .min(MIN_YEAR, `Năm sinh không được nhỏ hơn ${MIN_YEAR}.`)
      .refine((y) => y <= new Date().getFullYear() - MIN_AGE, 'Năm sinh không hợp lệ.')
      .nullable()
      .optional()
  ),
});

export { profileExtraSchema };
export default { profileExtraSchema };
