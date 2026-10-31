import careService from '../services/careService.js';
import incidentService from '../services/incidentService.js';
import { sendSuccess } from '../utils/response.js';

const wrap = (message, status, fn) => async (req, res, next) => {
  try {
    const data = await fn(req);
    return sendSuccess(res, message, data, status);
  } catch (err) {
    return next(err);
  }
};

export const checkIn = wrap('Tiếp nhận thú cưng thành công.', 200, (req) =>
  careService.checkIn(req.user, req.params.id, req.body, req.file, req)
);

export const start = wrap('Đã bắt đầu thực hiện dịch vụ.', 200, (req) =>
  careService.startService(req.user, req.params.id, req)
);

export const complete = wrap('Hoàn tất lịch hẹn thành công.', 200, (req) =>
  careService.completeService(req.user, req.params.id, req.body, req.file, req)
);

export const petCareHistory = wrap('Lấy sổ tay chăm sóc thành công.', 200, (req) =>
  careService.listPetCareHistory(req.user, req.params.petId, req.query)
);

export const createIncident = wrap('Đã ghi nhận sự cố.', 201, (req) =>
  incidentService.createIncident(req.user, req.body, req)
);

export const listIncidents = wrap('Lấy danh sách sự cố thành công.', 200, (req) =>
  incidentService.listIncidents(req.user, req.query)
);

export const getIncident = wrap('Lấy thông tin sự cố thành công.', 200, (req) =>
  incidentService.getIncident(req.user, req.params.id)
);

export const updateIncident = wrap('Cập nhật sự cố thành công.', 200, (req) =>
  incidentService.updateIncident(req.user, req.params.id, req.body, req)
);
