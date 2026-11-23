import reportRepository from '../repositories/reportRepository.js';
import systemLogRepository from '../repositories/systemLogRepository.js';
import { toCsv } from '../utils/csvExport.js';
import { toExcelBuffer } from '../utils/excelExport.js';

export const getRevenue = async ({ from, to, groupBy = 'day', format = 'json' }) => {
  const data = await reportRepository.getRevenueReport(from, to, groupBy);

  if (format === 'csv' || format === 'xlsx' || format === 'excel') {
    const headers = [
      { key: 'period', label: groupBy === 'month' ? 'Tháng' : 'Ngày', isDate: groupBy === 'day', align: 'center' },
      { key: 'invoice_count', label: 'Số lượng hóa đơn', isNumber: true, align: 'right' },
      { key: 'total_revenue', label: 'Tổng doanh thu (VNĐ)', isCurrency: true, align: 'right' },
      { key: 'avg_per_invoice', label: 'Trung bình/Hóa đơn (VNĐ)', isCurrency: true, align: 'right' },
    ];

    const totalInvoices = data.reduce((sum, r) => sum + r.invoice_count, 0);
    const totalRev = data.reduce((sum, r) => sum + r.total_revenue, 0);
    const avgTotal = totalInvoices > 0 ? Math.round(totalRev / totalInvoices) : 0;

    const summaryRow = {
      invoice_count: totalInvoices,
      total_revenue: totalRev,
      avg_per_invoice: avgTotal,
    };

    if (format === 'xlsx' || format === 'excel') {
      return {
        isExcel: true,
        buffer: await toExcelBuffer(headers, data, {
          title: 'Báo cáo doanh thu',
          dateRange: `Từ ${from} đến ${to}`,
          summaryRow,
          sheetName: 'Doanh thu',
        }),
        filename: `doanh_thu_${from}_${to}.xlsx`,
      };
    }

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

  return { isCsv: false, isExcel: false, data };
};

export const getServices = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getServicesReport(from, to);

  if (format === 'csv' || format === 'xlsx' || format === 'excel') {
    const headers = [
      { key: 'service_id', label: 'Mã DV', align: 'center' },
      { key: 'service_name', label: 'Tên dịch vụ', align: 'left' },
      { key: 'booking_count', label: 'Số lượt sử dụng', isNumber: true, align: 'right' },
      { key: 'total_revenue', label: 'Tổng doanh thu (VNĐ)', isCurrency: true, align: 'right' },
    ];

    const totalBookings = data.reduce((sum, r) => sum + r.booking_count, 0);
    const totalRev = data.reduce((sum, r) => sum + r.total_revenue, 0);

    const summaryRow = {
      booking_count: totalBookings,
      total_revenue: totalRev,
    };

    if (format === 'xlsx' || format === 'excel') {
      return {
        isExcel: true,
        buffer: await toExcelBuffer(headers, data, {
          title: 'Báo cáo dịch vụ bán chạy',
          dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
          summaryRow,
          sheetName: 'Dịch vụ',
        }),
        filename: `dich_vu_ban_chay_${from || 'all'}.xlsx`,
      };
    }

    return {
      isCsv: true,
      csv: toCsv(headers, data, {
        title: 'Báo cáo dịch vụ bán chạy',
        dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
        summaryRow,
      }),
      filename: `dich_vu_ban_chay_${from || 'all'}.csv`,
    };
  }

  return { isCsv: false, isExcel: false, data };
};

export const getEmployees = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getEmployeesReport(from, to);

  if (format === 'csv' || format === 'xlsx' || format === 'excel') {
    const headers = [
      { key: 'employee_id', label: 'Mã NV', align: 'center' },
      { key: 'employee_name', label: 'Tên nhân viên', align: 'left' },
      { key: 'phone', label: 'Số điện thoại', align: 'center' },
      { key: 'completed_count', label: 'Lịch hoàn tất', isNumber: true, align: 'right' },
      { key: 'cancelled_count', label: 'Lịch hủy', isNumber: true, align: 'right' },
      { key: 'total_assigned', label: 'Tổng lịch phân công', isNumber: true, align: 'right' },
      { key: 'cancel_rate', label: 'Tỉ lệ hủy (%)', isNumber: true, align: 'right', format: '0.0"%"' },
      { key: 'total_revenue', label: 'Doanh thu phụ trách (VNĐ)', isCurrency: true, align: 'right' },
    ];

    const totalCompleted = data.reduce((sum, r) => sum + r.completed_count, 0);
    const totalCancelled = data.reduce((sum, r) => sum + r.cancelled_count, 0);
    const totalAssigned = data.reduce((sum, r) => sum + r.total_assigned, 0);
    const totalRev = data.reduce((sum, r) => sum + r.total_revenue, 0);

    const summaryRow = {
      completed_count: totalCompleted,
      cancelled_count: totalCancelled,
      total_assigned: totalAssigned,
      total_revenue: totalRev,
    };

    if (format === 'xlsx' || format === 'excel') {
      return {
        isExcel: true,
        buffer: await toExcelBuffer(headers, data, {
          title: 'Báo cáo hiệu suất nhân viên',
          dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
          summaryRow,
          sheetName: 'Hiệu suất nhân viên',
        }),
        filename: `hieu_suat_nhan_vien_${from || 'all'}.xlsx`,
      };
    }

    return {
      isCsv: true,
      csv: toCsv(headers, data, {
        title: 'Báo cáo hiệu suất nhân viên',
        dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
        summaryRow,
      }),
      filename: `hieu_suat_nhan_vien_${from || 'all'}.csv`,
    };
  }

  return { isCsv: false, isExcel: false, data };
};

export const getAppointments = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getAppointmentsReport(from, to);

  if (format === 'csv' || format === 'xlsx' || format === 'excel') {
    const headers = [
      { key: 'status', label: 'Trạng thái lịch hẹn', align: 'left' },
      { key: 'count', label: 'Số lượng', isNumber: true, align: 'right' },
    ];
    const totalApt = (data.by_status || []).reduce((sum, r) => sum + r.count, 0);
    const summaryRow = { count: totalApt };

    if (format === 'xlsx' || format === 'excel') {
      return {
        isExcel: true,
        buffer: await toExcelBuffer(headers, data.by_status || [], {
          title: 'Báo cáo lịch hẹn theo trạng thái',
          dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
          summaryRow,
          sheetName: 'Lịch hẹn',
        }),
        filename: `lich_hen_trang_thai_${from || 'all'}.xlsx`,
      };
    }

    return {
      isCsv: true,
      csv: toCsv(headers, data.by_status, {
        title: 'Báo cáo lịch hẹn theo trạng thái',
        dateRange: from && to ? `Từ ${from} đến ${to}` : 'Toàn bộ thời gian',
        summaryRow,
      }),
      filename: `lich_hen_trang_thai_${from || 'all'}.csv`,
    };
  }

  return { isCsv: false, isExcel: false, data };
};

export const getCustomers = async ({ from, to, format = 'json' }) => {
  const data = await reportRepository.getCustomersReport(from, to);

  if (format === 'csv' || format === 'xlsx' || format === 'excel') {
    const headers = [
      { key: 'date', label: 'Ngày', isDate: true, align: 'center' },
      { key: 'new_count', label: 'Khách hàng mới', isNumber: true, align: 'right' },
    ];
    const totalNew = (data.new_customers_by_date || []).reduce((sum, r) => sum + r.new_count, 0);
    const summaryRow = { new_count: totalNew };

    if (format === 'xlsx' || format === 'excel') {
      return {
        isExcel: true,
        buffer: await toExcelBuffer(headers, data.new_customers_by_date || [], {
          title: 'Báo cáo khách hàng mới',
          dateRange: `Từ ${from} đến ${to}`,
          summaryRow,
          sheetName: 'Khách hàng',
        }),
        filename: `khach_hang_moi_${from}_${to}.xlsx`,
      };
    }

    return {
      isCsv: true,
      csv: toCsv(headers, data.new_customers_by_date, {
        title: 'Báo cáo khách hàng mới',
        dateRange: `Từ ${from} đến ${to}`,
        summaryRow,
      }),
      filename: `khach_hang_moi_${from}_${to}.csv`,
    };
  }

  return { isCsv: false, isExcel: false, data };
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
