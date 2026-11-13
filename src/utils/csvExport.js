/**
 * Xuất dữ liệu sang định dạng CSV chuyên nghiệp
 * Cải tiến chuẩn cho Excel:
 * 1. Dùng UTF-8 BOM (\ufeff) để Excel mở không bị lỗi font tiếng Việt.
 * 2. Phân tách bằng dấu chấm phẩy ';' (hoặc ',' tuỳ chọn, mặc định ',' và bao bọc chuỗi an toàn).
 * 3. Chống CSV Injection: nếu bắt đầu bằng =, +, -, @ thì thêm dấu '.
 * 4. Tiêu đề báo cáo (Report Header): Tên hệ thống, Loại báo cáo, Ngày xuất, Kỳ báo cáo.
 * 5. Định dạng ngày kiểu DD/MM/YYYY để Excel không bị biến thành `########`.
 * 6. Dòng tổng kết / Tổng cộng (Summary row).
 */

const formatVietnameseDate = (str) => {
  if (!str || typeof str !== 'string') return str;
  // Khớp YYYY-MM-DD
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return str;
};

export const toCsv = (headers, rows, options = {}) => {
  const {
    title = 'BÁO CÁO HỆ THỐNG PET SPA',
    dateRange = '',
    summaryRow = null,
  } = options;

  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val);

    // Chặn CSV Injection
    if (/^[=+\-@]/.test(str)) {
      str = "'" + str;
    }

    // Escape dấu ngoặc kép hoặc ký tự đặc biệt
    if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
      str = `"${str.replace(/"/g, '""')}"`;
    }

    return str;
  };

  const lines = [];

  // 1. Header thương hiệu và tiêu đề báo cáo
  lines.push(sanitizeCell(`HỆ THỐNG QUẢN LÝ PET SPA - ${title.toUpperCase()}`));
  if (dateRange) {
    lines.push(sanitizeCell(`Kỳ báo cáo: ${dateRange}`));
  }
  lines.push(sanitizeCell(`Ngày xuất file: ${new Date().toLocaleString('vi-VN')}`));
  lines.push(''); // Dòng trống ngăn cách

  // 2. Dòng tiêu đề cột
  const headerRow = headers.map((h) => sanitizeCell(h.label)).join(',');
  lines.push(headerRow);

  // 3. Dữ liệu
  rows.forEach((row) => {
    const dataRow = headers
      .map((h) => {
        let val = row[h.key] ?? '';
        // Định dạng ngày thành DD/MM/YYYY cho đẹp mắt
        if (h.isDate || h.key === 'period' || h.key === 'date') {
          val = formatVietnameseDate(val);
        }
        return sanitizeCell(val);
      })
      .join(',');
    lines.push(dataRow);
  });

  // 4. Dòng tổng cộng (nếu có)
  if (summaryRow) {
    const sumLine = headers
      .map((h, idx) => {
        if (idx === 0) return sanitizeCell('TỔNG CỘNG');
        if (summaryRow[h.key] !== undefined) return sanitizeCell(summaryRow[h.key]);
        return '';
      })
      .join(',');
    lines.push(sumLine);
  }

  const BOM = '\ufeff';
  return BOM + lines.join('\r\n');
};
