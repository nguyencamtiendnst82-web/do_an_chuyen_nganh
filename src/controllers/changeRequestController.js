import changeRequestService from '../services/changeRequestService.js';
import { sendSuccess } from '../utils/response.js';

export const create = async (req, res, next) => {
  try {
    const data = await changeRequestService.createRequest(req.user, req.params.id, req.body);
    return sendSuccess(res, 'Đã gửi đề xuất cho khách hàng.', data, 201);
  } catch (err) { next(err); }
};

export const list = async (req, res, next) => {
  try {
    const data = await changeRequestService.listRequests(req.user, req.params.id);
    return sendSuccess(res, 'Lấy danh sách đề xuất thành công.', data);
  } catch (err) { next(err); }
};

export const respond = async (req, res, next) => {
  try {
    const data = await changeRequestService.respond(req.user, req.params.id, req.body, req);
    return sendSuccess(res, req.body.accept ? 'Bạn đã đồng ý đề xuất.' : 'Bạn đã từ chối đề xuất.', data);
  } catch (err) { next(err); }
};
