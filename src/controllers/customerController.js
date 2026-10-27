import customerRepository from '../repositories/customerRepository.js';
import { sendSuccess } from '../utils/response.js';

/** GET /api/customers?search=...  (staff/admin) — trả tối đa 10 khách, chỉ các trường cần để chọn */
const lookup = async (req, res, next) => {
  try {
    const keyword = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const customers = await customerRepository.search({ keyword: keyword || undefined, limit });
    return sendSuccess(res, 'Tìm khách hàng thành công.', { customers });
  } catch (err) {
    next(err);
  }
};

export { lookup };
export default { lookup };
