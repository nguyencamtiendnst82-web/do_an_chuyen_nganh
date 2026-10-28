import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:00)?$/;

/**
 * Kiểm tra giờ hợp lệ và là bội số của 5 phút
 */
const validateTime = (val) => {
  const match = timeRegex.exec(val);
  if (!match) return false;
  const minutes = parseInt(match[2], 10);
  return minutes % 5 === 0;
};

/**
 * Chuẩn hóa thời gian về định dạng HH:MM:00
 */
export const normalizeTime = (timeStr) => {
  if (!timeStr) return timeStr;
  const parts = timeStr.trim().split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  return `${hh}:${mm}:00`;
};

/**
 * So sánh 2 chuỗi thời gian HH:MM hoặc HH:MM:SS
 * Trả về > 0 nếu t1 > t2
 */
export const compareTime = (t1, t2) => {
  const n1 = normalizeTime(t1);
  const n2 = normalizeTime(t2);
  return n1.localeCompare(n2);
};

export const createShiftSchema = z
  .object({
    shift_name: z
      .string({ required_error: 'Tên ca làm việc là bắt buộc' })
      .min(2, 'Tên ca phải có ít nhất 2 ký tự')
      .max(50, 'Tên ca tối đa 50 ký tự')
      .trim(),
    start_time: z
      .string({ required_error: 'Giờ bắt đầu là bắt buộc' })
      .refine(validateTime, 'Giờ bắt đầu phải theo định dạng HH:MM và là bội số của 5 phút'),
    end_time: z
      .string({ required_error: 'Giờ kết thúc là bắt buộc' })
      .refine(validateTime, 'Giờ kết thúc phải theo định dạng HH:MM và là bội số của 5 phút'),
    description: z.string().max(255, 'Mô tả tối đa 255 ký tự').trim().optional().nullable(),
    is_active: z.boolean().optional().default(true),
  })
  .refine((data) => compareTime(data.end_time, data.start_time) > 0, {
    message: 'Giờ kết thúc ca phải sau giờ bắt đầu',
    path: ['end_time'],
  });

export const updateShiftSchema = z
  .object({
    shift_name: z
      .string()
      .min(2, 'Tên ca phải có ít nhất 2 ký tự')
      .max(50, 'Tên ca tối đa 50 ký tự')
      .trim()
      .optional(),
    start_time: z
      .string()
      .refine(validateTime, 'Giờ bắt đầu phải theo định dạng HH:MM và là bội số của 5 phút')
      .optional(),
    end_time: z
      .string()
      .refine(validateTime, 'Giờ kết thúc phải theo định dạng HH:MM và là bội số của 5 phút')
      .optional(),
    description: z.string().max(255, 'Mô tả tối đa 255 ký tự').trim().optional().nullable(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_time && data.end_time) {
        return compareTime(data.end_time, data.start_time) > 0;
      }
      return true;
    },
    {
      message: 'Giờ kết thúc ca phải sau giờ bắt đầu',
      path: ['end_time'],
    }
  );

