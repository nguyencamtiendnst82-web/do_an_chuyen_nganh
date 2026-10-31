import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

const connection = {
  query: jest.fn(),
  end: jest.fn(),
};

const createConnection = jest.fn();
const seedDatabase = jest.fn();
const confirm = jest.fn();

jest.unstable_mockModule('mysql2/promise', () => ({
  default: { createConnection },
}));
jest.unstable_mockModule('../scripts/seed.js', () => ({
  default: seedDatabase,
}));

const { default: initDatabase } = await import('../scripts/init-db.js');
const originalArgv = [...process.argv];

describe('init-db CLI entrypoint', () => {
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    process.argv = [process.execPath, 'scripts/init-db.js'];
    createConnection.mockResolvedValue(connection);
    connection.query.mockResolvedValue([[{ SCHEMA_NAME: 'pet_spa_db' }], []]);
    connection.end.mockResolvedValue(undefined);
    confirm.mockResolvedValue('yes');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test.each([
    ['without --yes', []],
    ['with --yes', ['--yes']],
  ])('refuses an existing database %s', async (_label, flags) => {
    process.argv.push(...flags);

    await expect(initDatabase({ confirm })).rejects.toThrow(/đã tồn tại/i);

    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(connection.query).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls[0][0]).toMatch(/INFORMATION_SCHEMA\.SCHEMATA/i);
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(seedDatabase).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(flags.length === 0 ? 1 : 0);
  });
});
