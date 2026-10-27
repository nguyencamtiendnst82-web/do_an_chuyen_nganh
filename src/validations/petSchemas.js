import { z } from 'zod';
import { currentYearMonth } from '../utils/age.js';

const emptyToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

const toNumber = (v) => {
  if (v === '' || v === null) return null;
  if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return v;
};

const optionalText = (max, label) =>
  z.preprocess(emptyToNull, z.string().trim().max(max, `${label} tối đa ${max} ký tự`).nullable().optional());

const MAX_PET_AGE_YEARS = 40;

/** Tháng sinh dạng YYYY-MM, không ở tương lai và không quá 40 năm trước */
const birthMonth = z.preprocess(
  emptyToNull,
  z.string({ invalid_type_error: 'Tháng sinh không hợp lệ' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng sinh phải có dạng năm-tháng (VD: 2024-05)')
    .refine((v) => v <= currentYearMonth(), 'Tháng sinh không được ở tương lai')
    .refine((v) => {
      const now = new Date();
      const earliest = `${now.getFullYear() - MAX_PET_AGE_YEARS}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return v >= earliest;
    }, `Tháng sinh không hợp lệ (tối đa ${MAX_PET_AGE_YEARS} năm trước)`)
    .nullable()
    .optional()
);

const shape = {
  name: z.string({ required_error: 'Tên thú cưng là bắt buộc', invalid_type_error: 'Tên thú cưng không hợp lệ' })
    .trim()
    .min(1, 'Tên thú cưng là bắt buộc')
    .max(100, 'Tên thú cưng tối đa 100 ký tự'),

  species: z.enum(['dog', 'cat', 'other'], { errorMap: () => ({ message: 'Loài phải là chó, mèo hoặc khác' }) }),

  gender: z.enum(['male', 'female', 'unknown'], { errorMap: () => ({ message: 'Giới tính không hợp lệ' }) }),

  breed: optionalText(100, 'Giống loài'),

  birth_month: birthMonth,

  weight_kg: z.preprocess(
    toNumber,
    z.number({ invalid_type_error: 'Cân nặng phải là số' })
      .min(0.1, 'Cân nặng tối thiểu 0,1 kg')
      .max(150, 'Cân nặng tối đa 150 kg')
      .nullable()
      .optional()
  ),

  special_notes: optionalText(2000, 'Ghi chú'),
};

const createPetSchema = z.object({
  ...shape,
  species: shape.species.optional(),
  gender: shape.gender.optional(),
  // Chỉ staff/admin được dùng để tạo hộ khách; với customer sẽ bị bỏ qua
  customer_id: z.preprocess(
    toNumber,
    z.number({ invalid_type_error: 'Mã khách hàng không hợp lệ' }).int().positive().nullable().optional()
  ),
});

const updatePetSchema = z
  .object({
    name: shape.name.optional(),
    species: shape.species.optional(),
    gender: shape.gender.optional(),
    breed: shape.breed,
    birth_month: shape.birth_month,
    weight_kg: shape.weight_kg,
    special_notes: shape.special_notes,
    status: z.enum(['active', 'inactive'], { errorMap: () => ({ message: 'Trạng thái không hợp lệ' }) }).optional(),
  })
  .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
    message: 'Không có dữ liệu để cập nhật.',
  });

export { createPetSchema, updatePetSchema };
export default { createPetSchema, updatePetSchema };
