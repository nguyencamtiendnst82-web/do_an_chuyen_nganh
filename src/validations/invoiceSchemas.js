import { z } from 'zod';

export const surchargeItemSchema = z.object({
  item_name: z.string().trim().min(1, 'Tên phụ phí không được để trống').max(150, 'Tên phụ phí tối đa 150 ký tự'),
  quantity: z.coerce.number().int().positive('Số lượng phụ phí phải là số nguyên dương').default(1),
  unit_price: z.coerce.number().min(0, 'Đơn giá không được âm'),
});

export const createInvoiceSchema = z.object({
  notes: z.string().trim().max(2000, 'Ghi chú hóa đơn tối đa 2000 ký tự').nullable().optional(),
  surcharges: z.array(surchargeItemSchema).optional().default([]),
}).strict();

export const createPaymentSchema = z.object({
  amount: z.coerce.number().positive('Số tiền thanh toán phải lớn hơn 0').min(1000, 'Số tiền thanh toán tối thiểu là 1.000đ'),
  payment_method: z.enum(['cash', 'bank_transfer', 'momo_simulated', 'card'], {
    error: () => 'Phương thức thanh toán phải là cash, bank_transfer, momo_simulated hoặc card',
  }),
  notes: z.string().trim().max(255, 'Ghi chú tối đa 255 ký tự').nullable().optional(),
}).strict();

export const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  appointment_id: z.coerce.number().int().positive().optional(),
});
