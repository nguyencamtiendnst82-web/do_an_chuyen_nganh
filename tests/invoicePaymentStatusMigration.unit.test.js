import { jest, describe, test, expect } from '@jest/globals';

jest.unstable_mockModule('../src/config/db.js', () => ({
  pool: { query: jest.fn(), end: jest.fn() },
}));

const { migrateInvoicePaymentStatus } = await import('../scripts/migrate-invoice-payment-status.js');

const oldColumnMetadata = {
  COLUMN_TYPE: "enum('unpaid','paid','refunded')",
  IS_NULLABLE: 'YES',
  COLUMN_DEFAULT: 'unpaid',
  COLUMN_COMMENT: 'Trạng thái thanh toán',
};

const updatedColumnMetadata = {
  ...oldColumnMetadata,
  COLUMN_TYPE: "enum('unpaid','partially_paid','paid','refunded')",
};

describe('invoice payment status migration', () => {
  test('adds partially_paid while preserving existing enum states', async () => {
    const db = {
      query: jest.fn()
        .mockResolvedValueOnce([[oldColumnMetadata], []])
        .mockResolvedValueOnce([{}, []]),
    };

    await expect(migrateInvoicePaymentStatus(db)).resolves.toBe(true);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[0][0]).toMatch(/INFORMATION_SCHEMA\.COLUMNS/i);
    expect(db.query.mock.calls[0][0]).toMatch(/COLUMN_TYPE,\s*IS_NULLABLE,\s*COLUMN_DEFAULT,\s*COLUMN_COMMENT/i);
    expect(db.query.mock.calls[1][0]).toMatch(
      /ENUM\('unpaid', 'partially_paid', 'paid', 'refunded'\)/
    );
    expect(db.query.mock.calls[1][0]).toMatch(/\bNULL\s+DEFAULT 'unpaid'\s+COMMENT 'Trạng thái thanh toán'/i);
    expect(db.query.mock.calls[1][0]).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
  });

  test('does not alter a column that already has the new enum', async () => {
    const db = {
      query: jest.fn().mockResolvedValueOnce([[updatedColumnMetadata], []]),
    };

    await expect(migrateInvoicePaymentStatus(db)).resolves.toBe(false);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('stops without DDL for a missing column or unexpected enum', async () => {
    const missingColumnDb = {
      query: jest.fn().mockResolvedValueOnce([[], []]),
    };
    const unexpectedTypeDb = {
      query: jest.fn().mockResolvedValueOnce([[
        { ...oldColumnMetadata, COLUMN_TYPE: "enum('unpaid','paid','refunded','void')" },
      ], []]),
    };

    await expect(migrateInvoicePaymentStatus(missingColumnDb)).rejects.toThrow(/Không tìm thấy/i);
    await expect(migrateInvoicePaymentStatus(unexpectedTypeDb)).rejects.toThrow(/không khớp/i);
    expect(missingColumnDb.query).toHaveBeenCalledTimes(1);
    expect(unexpectedTypeDb.query).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['IS_NULLABLE', 'NO'],
    ['COLUMN_DEFAULT', 'paid'],
    ['COLUMN_COMMENT', 'Khác'],
  ])('refuses old enum with unexpected %s without DDL', async (property, value) => {
    const db = {
      query: jest.fn().mockResolvedValueOnce([[
        { ...oldColumnMetadata, [property]: value },
      ], []]),
    };

    await expect(migrateInvoicePaymentStatus(db)).rejects.toThrow(/không khớp schema dự kiến/i);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['IS_NULLABLE', 'NO'],
    ['COLUMN_DEFAULT', 'paid'],
    ['COLUMN_COMMENT', 'Khác'],
  ])('does not skip updated enum with unexpected %s', async (property, value) => {
    const db = {
      query: jest.fn().mockResolvedValueOnce([[
        { ...updatedColumnMetadata, [property]: value },
      ], []]),
    };

    await expect(migrateInvoicePaymentStatus(db)).rejects.toThrow(/không khớp schema dự kiến/i);
    expect(db.query).toHaveBeenCalledTimes(1);
  });
});
