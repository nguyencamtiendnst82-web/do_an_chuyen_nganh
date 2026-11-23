import ExcelJS from 'exceljs';

/**
 * Xuất dữ liệu báo cáo sang định dạng Excel (.xlsx) chuyên nghiệp
 * - Giao diện chuẩn doanh nghiệp: Font Arial, màu thương hiệu Pet Spa, căn lề tự động
 * - Định dạng số tiền tệ chuẩn: #,##0 "VNĐ" (không hiển thị số thô)
 * - Định dạng ngày tháng: DD/MM/YYYY chuẩn Việt Nam (không bị ###)
 * - Độ rộng cột (width) tự động tính toán + đệm rộng rãi (không bị che khuất)
 * - Dòng tổng cộng (Summary row) nổi bật với viền đôi kế toán
 */
export const toExcelBuffer = async (headers, rows, options = {}) => {
  const {
    title = 'BÁO CÁO HỆ THỐNG PET SPA',
    dateRange = '',
    summaryRow = null,
    sheetName = 'Báo cáo',
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pet Spa Management System';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ showGridLines: true }],
  });

  const colCount = Math.max(headers.length, 4);

  // 1. Tiêu đề báo cáo
  worksheet.mergeCells(1, 1, 1, colCount);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `HỆ THỐNG QUẢN LÝ PET SPA - ${title.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }, // Indigo-600
  };
  worksheet.getRow(1).height = 36;

  // 2. Khoảng thời gian
  worksheet.mergeCells(2, 1, 2, colCount);
  const dateRangeCell = worksheet.getCell(2, 1);
  dateRangeCell.value = dateRange ? `Kỳ báo cáo: ${dateRange}` : 'Kỳ báo cáo: Toàn bộ thời gian';
  dateRangeCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
  dateRangeCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 20;

  // 3. Thời điểm xuất file
  worksheet.mergeCells(3, 1, 3, colCount);
  const exportDateCell = worksheet.getCell(3, 1);
  exportDateCell.value = `Ngày xuất file: ${new Date().toLocaleString('vi-VN')}`;
  exportDateCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };
  exportDateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(3).height = 18;

  // 4. Dòng trống
  worksheet.getRow(4).height = 10;

  // 5. Tiêu đề các cột
  const headerRowNumber = 5;
  const headerRow = worksheet.getRow(headerRowNumber);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h.label;
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF334155' }, // Slate-700
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });
  headerRow.height = 28;

  // 6. Dữ liệu các dòng
  let currentRowNumber = 6;
  rows.forEach((row, rowIndex) => {
    const dataRow = worksheet.getRow(currentRowNumber);
    const isEven = rowIndex % 2 === 1;
    const bgArgb = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    headers.forEach((h, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      let rawVal = row[h.key];

      if (h.isDate && typeof rawVal === 'string') {
        const match = rawVal.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          rawVal = `${match[3]}/${match[2]}/${match[1]}`;
        }
      }

      if (h.isCurrency || h.isNumber) {
        const num = Number(rawVal);
        cell.value = Number.isFinite(num) ? num : 0;
        if (h.isCurrency) {
          cell.numFmt = '#,##0" VNĐ"';
        } else if (h.format) {
          cell.numFmt = h.format;
        } else {
          cell.numFmt = '#,##0';
        }
      } else {
        cell.value = rawVal ?? '';
      }

      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E293B' } };
      cell.alignment = {
        horizontal: h.align || (h.isCurrency || h.isNumber ? 'right' : h.isDate ? 'center' : 'left'),
        vertical: 'middle',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgArgb },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    dataRow.height = 22;
    currentRowNumber++;
  });

  // 7. Dòng tổng cộng (Summary row)
  if (summaryRow) {
    const sumRow = worksheet.getRow(currentRowNumber);
    headers.forEach((h, colIdx) => {
      const cell = sumRow.getCell(colIdx + 1);
      if (colIdx === 0) {
        cell.value = 'TỔNG CỘNG';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (summaryRow[h.key] !== undefined) {
        const num = Number(summaryRow[h.key]);
        cell.value = Number.isFinite(num) ? num : summaryRow[h.key];
        if (h.isCurrency) {
          cell.numFmt = '#,##0" VNĐ"';
        } else if (h.isNumber) {
          cell.numFmt = '#,##0';
        }
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.value = '';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEF2FF' }, // Indigo-50
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF6366F1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'double', color: { argb: 'FF4338CA' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    sumRow.height = 26;
  }

  // 8. Tự động căn chỉnh độ rộng cột rộng rãi, tuyệt đối không bị ###
  headers.forEach((h, idx) => {
    let maxLen = (h.label || '').length;
    rows.forEach((r) => {
      let v = r[h.key];
      if (v !== null && v !== undefined) {
        let str = String(v);
        if (h.isCurrency) str = `${Number(v).toLocaleString('vi-VN')} VNĐ`;
        if (str.length > maxLen) maxLen = str.length;
      }
    });
    if (summaryRow && summaryRow[h.key] !== undefined) {
      let str = String(summaryRow[h.key]);
      if (h.isCurrency) str = `${Number(summaryRow[h.key]).toLocaleString('vi-VN')} VNĐ`;
      if (str.length > maxLen) maxLen = str.length;
    }

    const col = worksheet.getColumn(idx + 1);
    col.width = Math.max(maxLen + 6, 18);
  });

  return await workbook.xlsx.writeBuffer();
};
