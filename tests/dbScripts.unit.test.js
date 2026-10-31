import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
  assertDatabaseDoesNotExist,
  assertSeedDatabaseIsEmpty,
  applySchemaToNewDatabase,
  buildSafeSchemaSql,
  REQUIRED_SEED_TABLES,
} from '../scripts/dbSafety.js';

const connection = {
  query: jest.fn(),
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

const pool = {
  getConnection: jest.fn(),
  end: jest.fn(),
};

jest.unstable_mockModule('../src/config/db.js', () => ({ pool }));
const { default: seedDatabase } = await import('../scripts/seed.js');

describe('DB setup safety helpers', () => {
  test('refuses to initialize an existing database without executing DDL', async () => {
    const query = jest.fn().mockResolvedValue([[{ SCHEMA_NAME: 'pet_spa_db' }], []]);

    await expect(assertDatabaseDoesNotExist({ query }, 'pet_spa_db')).rejects.toThrow(
      /đã tồn tại.*không có dữ liệu nào bị thay đổi/i
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/INFORMATION_SCHEMA\.SCHEMATA/i);
  });

  test('builds schema SQL without DROP and targets the configured database', () => {
    const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
    const originalSchema = fs.readFileSync(schemaPath, 'utf8');
    const safeSql = buildSafeSchemaSql(originalSchema, 'pet_spa_test');

    expect(safeSql).not.toMatch(/\bDROP\s+DATABASE\b/i);
    expect(safeSql).toContain('CREATE DATABASE `pet_spa_test`');
    expect(safeSql).toContain('USE `pet_spa_test`;');
    expect(safeSql).toMatch(/CREATE TABLE `users`/);
  });

  test('records ownership of a newly created database when schema execution fails', async () => {
    const schemaPath = path.resolve(process.cwd(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const query = jest.fn()
      .mockResolvedValueOnce([{}, []])
      .mockResolvedValueOnce([{}, []])
      .mockRejectedValueOnce(new Error('simulated schema failure'));

    await expect(applySchemaToNewDatabase({ query }, schema, 'pet_spa_test'))
      .rejects.toMatchObject({
        databaseCreated: true,
        databaseName: 'pet_spa_test',
      });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[0][0]).toMatch(/^CREATE DATABASE `pet_spa_test`/i);
    expect(query.mock.calls.every(([statement]) => !/\bDROP\b|\bTRUNCATE\b|\bDELETE\b/i.test(statement))).toBe(true);
  });

  test('refuses the next initialization attempt for the preserved partial database', async () => {
    const query = jest.fn().mockResolvedValue([[{ SCHEMA_NAME: 'pet_spa_test' }], []]);

    await expect(assertDatabaseDoesNotExist({ query }, 'pet_spa_test')).rejects.toThrow(
      /đã tồn tại.*không có dữ liệu nào bị thay đổi/i
    );
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/INFORMATION_SCHEMA\.SCHEMATA/i);
  });

  test('rejects unsafe database names and unexpected destructive schema statements', () => {
    const schema = [
      'DROP DATABASE IF EXISTS `pet_spa_db`;',
      'CREATE DATABASE `pet_spa_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
      'USE `pet_spa_db`;',
      'DROP TABLE `users`;',
    ].join('\n');

    expect(() => buildSafeSchemaSql(schema, 'pet-spa')).toThrow(/DB_NAME không hợp lệ/i);
    expect(() => buildSafeSchemaSql(schema, 'pet_spa_test')).toThrow(/ngoài nhóm CREATE\/USE/i);
  });

  test('refuses seed when any required table is missing', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([[{ database_name: 'pet_spa_db' }], []])
      .mockResolvedValueOnce([[{ table_name: 'users' }], []]);

    await expect(assertSeedDatabaseIsEmpty({ query })).rejects.toThrow(/chưa có đầy đủ schema/i);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('refuses seed when any required table already contains rows', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([[{ database_name: 'pet_spa_db' }], []])
      .mockResolvedValueOnce([REQUIRED_SEED_TABLES.map((table_name) => ({ table_name })), []])
      .mockResolvedValueOnce([[{ 1: 1 }], []]);

    await expect(assertSeedDatabaseIsEmpty({ query })).rejects.toThrow(/không rỗng.*không có dữ liệu nào bị xóa hoặc ghi đè/i);
    expect(query).toHaveBeenCalledTimes(3);
  });
});

describe('seedDatabase refuses populated databases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connection.query.mockReset();
    connection.beginTransaction.mockReset().mockResolvedValue(undefined);
    connection.commit.mockReset();
    connection.rollback.mockReset().mockResolvedValue(undefined);
    connection.release.mockReset();
    pool.getConnection.mockReset().mockResolvedValue(connection);

    connection.query
      .mockResolvedValueOnce([[{ database_name: 'pet_spa_db' }], []])
      .mockResolvedValueOnce([REQUIRED_SEED_TABLES.map((table_name) => ({ table_name })), []])
      .mockResolvedValueOnce([[{ 1: 1 }], []]);
  });

  test('rolls back and performs no inserts if data already exists', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(seedDatabase()).rejects.toThrow(/không rỗng/i);

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(([sql]) => /^\s*INSERT\b/i.test(sql))).toBe(false);
    expect(connection.query.mock.calls.some(([sql]) => /^\s*TRUNCATE\b/i.test(sql))).toBe(false);
    expect(connection.release).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });

  test('inserts sample data and commits when the schema is complete and empty', async () => {
    connection.query.mockReset().mockImplementation(async (sql) => {
      if (/^SELECT DATABASE\(\)/i.test(sql)) {
        return [[{ database_name: 'pet_spa_db' }], []];
      }
      if (/INFORMATION_SCHEMA\.TABLES/i.test(sql)) {
        return [REQUIRED_SEED_TABLES.map((table_name) => ({ table_name })), []];
      }
      return [[], []];
    });

    await expect(seedDatabase()).resolves.toBe(true);

    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.query.mock.calls.some(([sql]) => /^\s*INSERT\b/i.test(sql))).toBe(true);
    expect(connection.query.mock.calls.some(([sql]) => /^\s*(TRUNCATE|DELETE)\b/i.test(sql))).toBe(false);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  test('rolls back earlier inserts when a later seed insert fails', async () => {
    const pendingInserts = [];
    connection.rollback.mockImplementation(async () => {
      pendingInserts.length = 0;
    });
    connection.query.mockReset().mockImplementation(async (sql) => {
      if (/^SELECT DATABASE\(\)/i.test(sql)) {
        return [[{ database_name: 'pet_spa_db' }], []];
      }
      if (/INFORMATION_SCHEMA\.TABLES/i.test(sql)) {
        return [REQUIRED_SEED_TABLES.map((table_name) => ({ table_name })), []];
      }
      if (/^SELECT 1 FROM/i.test(sql)) {
        return [[], []];
      }
      if (/^\s*INSERT\b/i.test(sql)) {
        pendingInserts.push(sql);
        if (/INSERT INTO `users`/i.test(sql)) {
          throw new Error('simulated failure after roles insert');
        }
      }
      return [[], []];
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(seedDatabase()).rejects.toThrow(/simulated failure after roles insert/i);

    expect(pendingInserts).toHaveLength(0);
    expect(connection.query.mock.calls.some(([sql]) => /INSERT INTO `roles`/i.test(sql))).toBe(true);
    expect(connection.query.mock.calls.some(([sql]) => /INSERT INTO `users`/i.test(sql))).toBe(true);
    expect(connection.query.mock.calls.some(([sql]) => /INSERT INTO `employees`/i.test(sql))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
