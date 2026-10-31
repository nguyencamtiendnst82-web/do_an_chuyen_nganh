const REQUIRED_SEED_TABLES = [
  'roles',
  'users',
  'pets',
  'services',
  'employees',
  'shifts',
  'employee_shifts',
  'appointments',
  'appointment_details',
  'pet_care_history',
  'invoices',
  'invoice_details',
  'payments',
  'incidents',
  'system_logs',
];

const quoteDatabaseName = (databaseName) => {
  if (typeof databaseName !== 'string' || !/^[A-Za-z0-9_]{1,64}$/.test(databaseName)) {
    throw new Error('DB_NAME không hợp lệ; chỉ chấp nhận tối đa 64 ký tự chữ, số hoặc gạch dưới.');
  }
  return `\`${databaseName}\``;
};

const splitSqlStatements = (sql) => {
  const statements = [];
  let statement = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (lineComment) {
      if (character === '\n') {
        lineComment = false;
        statement += character;
      }
      continue;
    }

    if (blockComment) {
      if (character === '*' && nextCharacter === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      statement += character;
      if (character === '\\' && quote !== '`' && nextCharacter) {
        statement += nextCharacter;
        index += 1;
      } else if (character === quote) {
        if (nextCharacter === quote) {
          statement += nextCharacter;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (character === '-' && nextCharacter === '-' && /\s/.test(sql[index + 2] || ' ')) {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && nextCharacter === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      statement += character;
      continue;
    }
    if (character === ';') {
      if (statement.trim()) {
        statements.push(statement.trim());
      }
      statement = '';
      continue;
    }
    statement += character;
  }

  if (quote || blockComment) {
    throw new Error('Schema có chuỗi hoặc comment chưa kết thúc; init đã bị dừng.');
  }
  if (statement.trim()) {
    statements.push(statement.trim());
  }
  return statements;
};

const assertDatabaseDoesNotExist = async (connection, databaseName) => {
  quoteDatabaseName(databaseName);
  const [rows] = await connection.query(
    `SELECT SCHEMA_NAME
     FROM INFORMATION_SCHEMA.SCHEMATA
     WHERE SCHEMA_NAME = ?
     LIMIT 1`,
    [databaseName]
  );

  if (rows.length > 0) {
    throw new Error(
      `Database "${databaseName}" đã tồn tại. Init bị từ chối để bảo vệ dữ liệu; không có dữ liệu nào bị thay đổi.`
    );
  }
};

const buildSafeSchemaSql = (schemaSql, databaseName) => {
  const quotedDatabaseName = quoteDatabaseName(databaseName);
  const lines = schemaSql.replace(/^\uFEFF/, '').split(/\r?\n/);
  const destructiveDropLine = 'DROP DATABASE IF EXISTS `pet_spa_db`;';
  const dropIndexes = lines
    .map((line, index) => (line.trim() === destructiveDropLine ? index : -1))
    .filter((index) => index >= 0);

  if (dropIndexes.length !== 1) {
    throw new Error('Schema không khớp định dạng dự kiến; từ chối chạy init để tránh thao tác không an toàn.');
  }
  lines.splice(dropIndexes[0], 1);

  let safeSql = lines.join('\n');
  const databaseDeclaration = 'CREATE DATABASE `pet_spa_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;';
  const databaseSelection = 'USE `pet_spa_db`;';
  if (safeSql.split(databaseDeclaration).length !== 2 || safeSql.split(databaseSelection).length !== 2) {
    throw new Error('Schema phải khai báo đúng một database pet_spa_db; init đã bị dừng.');
  }

  safeSql = safeSql
    .replace(databaseDeclaration, `CREATE DATABASE ${quotedDatabaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`)
    .replace(databaseSelection, `USE ${quotedDatabaseName};`);

  const statements = splitSqlStatements(safeSql);
  const allowedStatement = /^(CREATE DATABASE\b|USE\b|CREATE TABLE\b|CREATE INDEX\b)/i;

  if (statements.length === 0 || statements.some((statement) => !allowedStatement.test(statement))) {
    throw new Error('Schema chứa câu lệnh ngoài nhóm CREATE/USE được phép; init đã bị dừng.');
  }

  return safeSql;
};

const applySchemaToNewDatabase = async (connection, schemaSql, databaseName) => {
  const statements = splitSqlStatements(buildSafeSchemaSql(schemaSql, databaseName));
  const createDatabaseIndex = statements.findIndex((statement) => /^CREATE DATABASE\b/i.test(statement));
  if (createDatabaseIndex !== 0) {
    throw new Error('Schema phải tạo database trước các câu lệnh khác; init đã bị dừng.');
  }

  let databaseCreated = false;
  for (const statement of statements) {
    try {
      await connection.query(statement);
      if (/^CREATE DATABASE\b/i.test(statement)) {
        databaseCreated = true;
      }
    } catch (error) {
      const initError = new Error(
        `Không thể thực thi schema cho database "${databaseName}": ${error.message}`,
        { cause: error }
      );
      initError.databaseCreated = databaseCreated;
      initError.databaseName = databaseName;
      throw initError;
    }
  }
};

const assertSeedDatabaseIsEmpty = async (connection) => {
  const [databaseRows] = await connection.query('SELECT DATABASE() AS database_name');
  const databaseName = databaseRows[0]?.database_name;
  if (!databaseName) {
    throw new Error('Chưa chọn được database. Hãy kiểm tra DB_NAME và khởi tạo schema trước khi seed.');
  }

  const [tableRows] = await connection.query(
    `SELECT TABLE_NAME AS table_name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
  );
  const existingTables = new Set(tableRows.map((row) => row.table_name));
  const missingTables = REQUIRED_SEED_TABLES.filter((table) => !existingTables.has(table));

  if (missingTables.length > 0) {
    throw new Error(
      `Database "${databaseName}" chưa có đầy đủ schema; thiếu bảng: ${missingTables.join(', ')}. Không có dữ liệu mẫu nào được thêm.`
    );
  }

  for (const table of REQUIRED_SEED_TABLES) {
    const [rows] = await connection.query(`SELECT 1 FROM \`${table}\` LIMIT 1`);
    if (rows.length > 0) {
      throw new Error(
        `Database "${databaseName}" không rỗng (đã có dữ liệu ở bảng "${table}"). Seed bị từ chối; không có dữ liệu nào bị xóa hoặc ghi đè.`
      );
    }
  }
};

export {
  assertDatabaseDoesNotExist,
  assertSeedDatabaseIsEmpty,
  applySchemaToNewDatabase,
  buildSafeSchemaSql,
  REQUIRED_SEED_TABLES,
};
