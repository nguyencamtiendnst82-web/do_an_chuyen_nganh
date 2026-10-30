import { hasOverlap, isFullyInsideShift, timeToMinutes } from '../src/utils/timeOverlap.js';

describe('Kiểm thử thuật toán hasOverlap và isFullyInsideShift', () => {
  describe('hasOverlap: Quy ước nửa mở [start, end)', () => {
    test('1. Hai khoảng kề nhau (aEnd === bStart) -> KHÔNG trùng (false)', () => {
      expect(hasOverlap('08:00', '09:00', '09:00', '10:00')).toBe(false);
      expect(hasOverlap('09:00', '10:00', '08:00', '09:00')).toBe(false);
    });

    test('2. Hai khoảng trùng khít nhau hoàn toàn -> TRÙNG (true)', () => {
      expect(hasOverlap('08:00', '09:00', '08:00', '09:00')).toBe(true);
    });

    test('3. Khoảng này bao trùm hoàn toàn khoảng kia -> TRÙNG (true)', () => {
      // A bao trùm B
      expect(hasOverlap('08:00', '12:00', '09:00', '10:00')).toBe(true);
      // B bao trùm A
      expect(hasOverlap('09:00', '10:00', '08:00', '12:00')).toBe(true);
    });

    test('4. Hai khoảng chồng lấn một phần (giao nhau) -> TRÙNG (true)', () => {
      // A bắt đầu trước, B kết thúc sau
      expect(hasOverlap('08:00', '10:00', '09:00', '11:00')).toBe(true);
      // B bắt đầu trước, A kết thúc sau
      expect(hasOverlap('09:00', '11:00', '08:00', '10:00')).toBe(true);
    });

    test('5. Hai khoảng hoàn toàn tách rời nhau -> KHÔNG trùng (false)', () => {
      expect(hasOverlap('08:00', '09:00', '10:00', '11:00')).toBe(false);
      expect(hasOverlap('10:00', '11:00', '08:00', '09:00')).toBe(false);
    });

    test('6. Kiểm tra với định dạng có giây (HH:MM:SS) hoặc dạng số phút', () => {
      expect(hasOverlap('08:00:00', '09:30:00', '09:00:00', '10:00:00')).toBe(true);
      expect(hasOverlap(480, 540, 540, 600)).toBe(false); // 08:00-09:00 và 09:00-10:00
      expect(hasOverlap(480, 570, 540, 600)).toBe(true);  // 08:00-09:30 và 09:00-10:00
    });
  });

  describe('isFullyInsideShift: Lịch hẹn phải nằm trọn trong ca làm', () => {
    test('1. Nằm trọn vẹn bên trong ca làm -> true', () => {
      expect(isFullyInsideShift('08:30', '10:00', '08:00', '12:00')).toBe(true);
    });

    test('2. Trùng đúng biên bắt đầu và kết thúc ca -> true', () => {
      expect(isFullyInsideShift('08:00', '12:00', '08:00', '12:00')).toBe(true);
    });

    test('3. Bắt đầu trước giờ ca làm -> false', () => {
      expect(isFullyInsideShift('07:30', '09:30', '08:00', '12:00')).toBe(false);
    });

    test('4. Kết thúc sau giờ ca làm -> false', () => {
      expect(isFullyInsideShift('11:00', '12:30', '08:00', '12:00')).toBe(false);
    });

    test('5. Nằm hoàn toàn ngoài ca làm việc -> false', () => {
      expect(isFullyInsideShift('13:00', '14:00', '08:00', '12:00')).toBe(false);
    });
  });
});

