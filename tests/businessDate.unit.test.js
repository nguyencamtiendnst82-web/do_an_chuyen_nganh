import { getVietnamDate } from '../src/utils/businessDate.js';
import { addDays, vietnamYmd } from '../frontend/src/utils/date.js';

describe('business date in Vietnam timezone', () => {
  test('uses the Vietnam calendar date around UTC midnight', () => {
    const beforeVietnamMidnight = new Date('2026-11-12T17:30:00.000Z');
    const beforeUtcMidnight = new Date('2026-11-13T16:59:59.000Z');
    const atVietnamMidnight = new Date('2026-11-13T17:00:00.000Z');

    expect(getVietnamDate(beforeVietnamMidnight)).toBe('2026-11-13');
    expect(getVietnamDate(beforeUtcMidnight)).toBe('2026-11-13');
    expect(getVietnamDate(atVietnamMidnight)).toBe('2026-11-14');
    expect(vietnamYmd(beforeVietnamMidnight)).toBe('2026-11-13');
  });

  test('calculates report date ranges using calendar days', () => {
    expect(addDays('2026-11-13', -30)).toBe('2026-10-14');
  });
});
