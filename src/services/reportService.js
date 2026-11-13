import reportRepository from '../repositories/reportRepository.js';
import systemLogRepository from '../repositories/systemLogRepository.js';
import { toCsv } from '../utils/csvExport.js';

export const getRevenue = async ({ from, to, groupBy = 'day', format = 'json' }) => {
  const data = await reportRepository.getRevenueReport(from, to, groupBy);

  if (format === 'csv') {
    const headers = [
      { key: 'period', label: groupBy === 'month' ? 'Tháng' : 'Ngày', isDate: groupBy === 'day' },
      { key: 'invoice_count', label: 'Số lượng hóa đơn' },
      { key: 'total_revenue', label: 'Tổng doanh thu (VNĐ)' },
      { key: 'avg_per_invoice', label: 'Trung bình/Hóa đơn (VNĐ)' },
    ];

    const totalInvoices = data.reduce((sum, r) => sum + r.invoice_count, 0);
    const totalRev = data.reduce((sum, r) => sum + r.total_revenue, 0);
    const avgTotal = totalInvoices > 0 ? Math.round(totalRev / totalInvoices) : 0;

    const summaryRow = {
      invoice_count: totalInvoices,
      total_revenue: totalRev,
      avg_per_invoice: avgTotal,
    };

    return {
      isCsv: true,
      csv: toCsv(headers, data, {
        title: 'Báo cáo doanh thu',
        dateRange: `Từ ${from} đến ${to}`,
        summaryRow,
      }),
      filename: `doanh_thu_${from}_${to}.csv`,
    };
  }

  return { isCsv: false, data };
};

export const getServices = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getServicesReport(from, to);

  if (format === 'csv') {
    const headers = [
      { key: 'service_id', label: 'Mã DV' },
      { key: 'service_name', label: 'Tên dịch vụ' },
      { key: 'booking_count', label: 'Số lượt sử dụng' },
      { key: 'total_revenue', label: 'Tổng doanh thu (VNĐ)' },
    ];

    const totalBookings = data.reduce((sum, r) => sum + r.booking_count, 0);
    const totalRev = data.reduce((sum, r) => sum + r.total_revenue, 0);

    return {
      isCsv: true,
      csv: toCsv(headers, data, {
        title: 'Báo cáo dịch vụ bán chạy',
        dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
        summaryRow: {
          booking_count: totalBookings,
          total_revenue: totalRev,
        },
      }),
      filename: `dich_vu_ban_chay_${from || 'all'}.csv`,
    };
  }

  return { isCsv: false, data };
};

export const getEmployees = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getEmployeesReport(from, to);

  if (format === 'csv') {
    const headers = [
      { key: 'employee_id', label: 'Mã NV' },
      { key: 'employee_name', label: 'Tên nhân viên' },
      { key: 'phone', label: 'Số điện thoại' },
      { key: 'completed_count', label: 'Lịch hoàn tất' },
      { key: 'cancelled_count', label: 'Lịch hủy' },
      { key: 'total_assigned', label: 'Tổng lịch phân công' },
      { key: 'cancel_rate', label: 'Tỉ lệ hủy (%)' },
      { key: 'total_revenue', label: 'Doanh thu phụ trách (VNĐ)' },
    ];

    const totalCompleted = data.reduce((sum, r) => sum + r.completed_count, 0);
    const totalCancelled = data.reduce((sum, r) => sum + r.cancelled_count, 0);
    const totalAssigned = data.reduce((sum, r) => sum + r.total_assigned, 0);
    const totalRev = data.reduce((sum, r) => sum + r.total_revenue, 0);

    return {
      isCsv: true,
      csv: toCsv(headers, data, {
        title: 'Báo cáo hiệu suất nhân viên',
        dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
        summaryRow: {
          completed_count: totalCompleted,
          cancelled_count: totalCancelled,
          total_assigned: totalAssigned,
          total_revenue: totalRev,
        },
      }),
      filename: `hieu_suat_nhan_vien_${from || 'all'}.csv`,
    };
  }

  return { isCsv: false, data };
};

export const getAppointments = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getAppointmentsReport(from, to);

  if (format === 'csv') {
    const headers = [
      { key: 'status', label: 'Trạng thái lịch hẹn' },
      { key: 'count', label: 'Số lượng' },
    ];
    const totalApt = (data.by_status || []).reduce((sum, r) => sum + r.count, 0);

    return {
      isCsv: true,
      csv: toCsv(headers, data.by_status, {
        title: 'Báo cáo lịch hẹn theo trạng thái',
        dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
        summaryRow: { count: totalApt },
      }),
      filename: `lich_hen_trang_thai_${from || 'all'}.csv`,
    };
  }

  return { isCsv: false, data };
};

export const getCustomers = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getCustomersReport(from, to);

  if (format === 'csv') {
    const headers = [
      { key: 'date', label: 'Ngày', isDate: true },
      { key: 'new_count', label: 'Khách hàng mới' },
    ];
    const totalNew = (data.new_customers_by_date || []).reduce((sum, r) => sum + r.new_count, 0);

    return {
      isCsv: true,
      csv: toCsv(headers, data.new_customers_by_date, {
        title: 'Báo cáo khách hàng mới',
        dateRange: `Từ ${from} đến ${to}`,
        summaryRow: { new_count: totalNew },
      }),
      filename: `khach_hang_moi_${from}_${to}.csv`,
    };
  }

  return { isCsv: false, data };
};

export const getLogs = async (query) => {
  const userId = query.userId || query.user_id;
  return await systemLogRepository.getLogs({
    userId,
    action: query.action,
    from: query.from,
    to: query.to,
    page: query.page,
    limit: query.limit,
  });
};

export default {
  getRevenue,
  getServices,
  getEmployees,
  getAppointments,
  getCustomers,
  getLogs,
};
