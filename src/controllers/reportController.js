import reportService from '../services/reportService.js';
import { dateRangeSchema, logQuerySchema } from '../validations/reportSchemas.js';
import { sendSuccess } from '../utils/response.js';
import { httpError } from '../utils/params.js';

const parseDateRange = (query) => {
  const result = dateRangeSchema.safeParse(query);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw httpError(400, firstIssue.message);
  }
  return result.data;
};

const handleOutput = (res, result, successMsg = 'Lấy báo cáo thành công.') => {
  if (result.isCsv) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.status(200).send(result.csv);
  }
  return sendSuccess(res, successMsg, result.data);
};

export const revenueReport = async (req, res, next) => {
  try {
    const validated = parseDateRange(req.query);
    const result = await reportService.getRevenue(validated);
    return handleOutput(res, result, 'Báo cáo doanh thu theo kỳ.');
  } catch (err) {
    return next(err);
  }
};

export const servicesReport = async (req, res, next) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const from = req.query.from;
    const to = req.query.to;
    if (from || to) {
      parseDateRange({ from: from || '2000-01-01', to: to || '2099-12-31' });
    }
    const result = await reportService.getServices({ from, to, format });
    return handleOutput(res, result, 'Báo cáo dịch vụ bán chạy.');
  } catch (err) {
    return next(err);
  }
};

export const employeesReport = async (req, res, next) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const from = req.query.from;
    const to = req.query.to;
    if (from || to) {
      parseDateRange({ from: from || '2000-01-01', to: to || '2099-12-31' });
    }
    const result = await reportService.getEmployees({ from, to, format });
    return handleOutput(res, result, 'Báo cáo hiệu suất nhân viên.');
  } catch (err) {
    return next(err);
  }
};

export const appointmentsReport = async (req, res, next) => {
  try {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const from = req.query.from;
    const to = req.query.to;
    if (from || to) {
      parseDateRange({ from: from || '2000-01-01', to: to || '2099-12-31' });
    }
    const result = await reportService.getAppointments({ from, to, format });
    return handleOutput(res, result, 'Báo cáo lịch hẹn theo trạng thái và khung giờ.');
  } catch (err) {
    return next(err);
  }
};

export const customersReport = async (req, res, next) => {
  try {
    const validated = parseDateRange(req.query);
    const result = await reportService.getCustomers(validated);
    return handleOutput(res, result, 'Báo cáo thống kê khách hàng.');
  } catch (err) {
    return next(err);
  }
};

export const logsReport = async (req, res, next) => {
  try {
    const parseRes = logQuerySchema.safeParse(req.query);
    if (!parseRes.success) {
      throw httpError(400, parseRes.error.issues[0].message);
    }
    const data = await reportService.getLogs(parseRes.data);
    return sendSuccess(res, 'Lấy danh sách nhật ký hệ thống thành công.', data);
  } catch (err) {
    return next(err);
  }
};

export default {
  revenueReport,
  servicesReport,
  employeesReport,
  appointmentsReport,
  customersReport,
  logsReport,
};
