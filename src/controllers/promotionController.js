import promotionService from '../services/promotionService.js';
import { sendSuccess } from '../utils/response.js';

const wrap = (fn, message, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    return sendSuccess(res, message, data, status);
  } catch (err) {
    return next(err);
  }
};

export const list = wrap(() => promotionService.listPromotions(), 'Lấy danh sách khuyến mãi thành công.');
export const create = wrap((req) => promotionService.createPromotion(req.user, req.body, req), 'Đã tạo chương trình khuyến mãi.', 201);
export const update = wrap((req) => promotionService.updatePromotion(req.user, req.params.id, req.body, req), 'Đã cập nhật chương trình khuyến mãi.');
export const setActive = wrap((req) => promotionService.setPromotionActive(req.user, req.params.id, req.body, req), 'Đã cập nhật trạng thái khuyến mãi.');
