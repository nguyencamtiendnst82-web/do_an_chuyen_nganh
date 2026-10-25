#!/usr/bin/env node
/**
 * convert-to-esm.mjs
 * Chuyển backend từ CommonJS (require / module.exports) sang ES Modules (import / export).
 *
 *   node scripts/convert-to-esm.mjs --dry     # chỉ xem sẽ đổi gì, không ghi file
 *   node scripts/convert-to-esm.mjs           # chuyển đổi thật
 *   node scripts/convert-to-esm.mjs src tests # chỉ chuyển các thư mục/file chỉ định
 *
 * NÊN COMMIT GIT TRƯỚC KHI CHẠY để có thể hoàn tác (git checkout .).
 */
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const userTargets = argv.filter((a) => !a.startsWith('--'));
const ROOT = process.cwd();
const DEFAULT_TARGETS = ['src', 'tests', 'backend', 'scripts', 'jest.config.js'];
const SKIP_DIRS = new Set(['node_modules', 'frontend', 'uploads', '.git', 'dist', 'coverage']);

const collect = (target, out) => {
  const abs = path.resolve(ROOT, target);
  if (!fs.existsSync(abs)) return;
  const stat = fs.statSync(abs);
  if (stat.isFile()) {
    if (abs.endsWith('.js')) out.push(abs);
    return;
  }
  for (const name of fs.readdirSync(abs)) {
    if (SKIP_DIRS.has(name)) continue;
    collect(path.join(abs, name), out);
  }
};

const convert = (source, filePath) => {
  const notes = [];
  const EOL = source.includes('\r\n') ? '\r\n' : '\n';
  let code = source;

  const hasCjs = /\brequire\s*\(|\bmodule\.exports\b|\bexports\./.test(code);
  if (!hasCjs) return { code: source, notes, changed: false };

  const topImports = [];
  let needDotenv = false;

  code = code.replace(/^[ \t]*['"]use strict['"];?[ \t]*\r?\n/m, '');

  // dotenv: phải nạp TRƯỚC mọi import khác
  code = code.replace(/^require\(\s*(['"])dotenv\1\s*\)\.config\(\s*\)\s*;?[ \t]*\r?\n?/gm, () => {
    needDotenv = true;
    return '';
  });
  const dotenvDecl = code.match(/^(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*(['"])dotenv\2\s*\)\s*;?[ \t]*\r?\n?/m);
  if (dotenvDecl) {
    const v = dotenvDecl[1];
    const callRe = new RegExp(`^${v}\\.config\\(\\s*\\)\\s*;?[ \\t]*\\r?\\n?`, 'm');
    if (callRe.test(code)) {
      code = code.replace(callRe, '').replace(dotenvDecl[0], '');
      needDotenv = true;
    } else {
      notes.push('dotenv.config(...) có tham số: hãy kiểm tra thứ tự nạp .env.');
    }
  }

  const fixSpec = (spec) => {
    if (!spec.startsWith('.')) return spec;
    if (/\.(m?js|cjs|node)$/.test(spec)) return spec;
    if (spec.endsWith('.json')) return spec;
    const abs = path.resolve(path.dirname(filePath), spec);
    if (fs.existsSync(`${abs}.js`)) return `${spec}.js`;
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory() && fs.existsSync(path.join(abs, 'index.js'))) {
      return `${spec.replace(/\/$/, '')}/index.js`;
    }
    notes.push(`Không tìm thấy file cho "${spec}", đã thêm .js — hãy kiểm tra.`);
    return `${spec}.js`;
  };
  const jsonAttr = (spec) => (spec.endsWith('.json') ? " with { type: 'json' }" : '');

  // const { a, b: c } = require('x');
  code = code.replace(
    /^(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)\s*;?[ \t]*$/gm,
    (full, names, _q, spec) => {
      if (/\/\/|\/\*/.test(names)) {
        notes.push(`Destructuring có chú thích bên trong, cần sửa tay: ${full.trim().slice(0, 60)}`);
        return full;
      }
      const list = names
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.replace(/\s*:\s*/, ' as '));
      return `import { ${list.join(', ')} } from '${fixSpec(spec)}'${jsonAttr(spec)};`;
    }
  );

  // const x = require('x').prop;
  code = code.replace(
    /^(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)\.(\w+)\s*;?[ \t]*$/gm,
    (_f, name, _q, spec, prop) =>
      name === prop
        ? `import { ${prop} } from '${fixSpec(spec)}';`
        : `import { ${prop} as ${name} } from '${fixSpec(spec)}';`
  );

  // const x = require('x');
  code = code.replace(
    /^(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)\s*;?[ \t]*$/gm,
    (_f, name, _q, spec) => `import ${name} from '${fixSpec(spec)}'${jsonAttr(spec)};`
  );

  // require('x');
  code = code.replace(
    /^require\(\s*(['"])([^'"]+)\1\s*\)\s*;?[ \t]*$/gm,
    (_f, _q, spec) => `import '${fixSpec(spec)}';`
  );

  // module.exports
  const shorthand = code.match(/^module\.exports\s*=\s*\{([^{}]*)\}\s*;?[ \t]*$/m);
  let handled = false;
  if (shorthand) {
    const inner = shorthand[1].replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const tokens = inner.split(',').map((s) => s.trim()).filter(Boolean);
    if (tokens.every((t) => /^[A-Za-z_$][\w$]*$/.test(t))) {
      const names = tokens.join(', ');
      code = code.replace(shorthand[0], `export { ${names} };${EOL}export default { ${names} };`);
      handled = true;
    }
  }
  if (!handled && /^module\.exports\s*=\s*/m.test(code)) {
    const startsWithObject = /^module\.exports\s*=\s*\{/m.test(code);
    code = code.replace(/^module\.exports\s*=\s*/m, 'export default ');
    if (startsWithObject) {
      notes.push('module.exports là object dạng key: value → chỉ có default export. Nơi nào import { tên } từ file này cần sửa.');
    }
  }
  if (/^(?:module\.)?exports\.\w+\s*=/m.test(code)) {
    notes.push('Có "exports.tên = ..." cần chuyển tay sang "export const tên = ...".');
  }

  // require.main === module
  if (/require\.main\s*===\s*module/.test(code)) {
    code = code.replace(/require\.main\s*===\s*module/g, 'import.meta.url === pathToFileURL(process.argv[1]).href');
    topImports.push("import { pathToFileURL } from 'node:url';");
  }

  // __dirname / __filename
  const usesDirname = /\b__dirname\b/.test(code) && !/\b(?:const|let|var)\s+__dirname\b/.test(code);
  const usesFilename = /\b__filename\b/.test(code) && !/\b(?:const|let|var)\s+__filename\b/.test(code);
  let dirnameBlock = '';
  if (usesDirname || usesFilename) {
    topImports.push("import { fileURLToPath as __fileURLToPath } from 'node:url';");
    topImports.push("import { dirname as __dirnameOf } from 'node:path';");
    dirnameBlock =
      `const __filename = __fileURLToPath(import.meta.url);${EOL}` +
      `const __dirname = __dirnameOf(__filename);${EOL}`;
  }

  // jest
  if (/\bjest\./.test(code) && !/@jest\/globals/.test(code) && !/jest\.config/.test(filePath)) {
    topImports.push("import { jest } from '@jest/globals';");
    if (/jest\.(mock|doMock|requireActual)\b/.test(code)) {
      notes.push('Có jest.mock(...): trong ESM phải dùng jest.unstable_mockModule + import() động. Cần sửa tay.');
    }
  }

  const header = [];
  if (needDotenv) header.push("import 'dotenv/config';");
  header.push(...topImports);

  if (header.length > 0) {
    const lines = code.split(/\r?\n/);
    let insertAt = 0;
    if (lines[0]?.startsWith('#!')) insertAt = 1;
    lines.splice(insertAt, 0, ...header);
    code = lines.join(EOL);
  }

  if (dirnameBlock) {
    const lines = code.split(/\r?\n/);
    let lastImport = -1;
    let i = 0;
    while (i < lines.length) {
      if (/^import\b/.test(lines[i])) {
        let j = i;
        while (j < lines.length && !/;\s*$/.test(lines[j])) j += 1;
        lastImport = j;
        i = j + 1;
      } else i += 1;
    }
    lines.splice(lastImport + 1, 0, '', ...dirnameBlock.trimEnd().split(EOL));
    code = lines.join(EOL);
  }

  code.split(/\r?\n/).forEach((line, idx) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (/\brequire\s*\(/.test(line) || /\bmodule\.exports\b/.test(line)) {
      notes.push(`Dòng ${idx + 1} còn dùng CommonJS (cần sửa tay): ${t.slice(0, 70)}`);
    }
  });

  return { code, notes, changed: code !== source };
};

const updatePackageJson = () => {
  const file = path.join(ROOT, 'package.json');
  if (!fs.existsSync(file)) return ['Không thấy package.json ở thư mục hiện tại, bỏ qua.'];
  const raw = fs.readFileSync(file, 'utf8');
  const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
  const indent = (raw.match(/^[ \t]+(?=")/m) || ['  '])[0];
  const pkg = JSON.parse(raw);
  const msgs = [];

  if (pkg.type !== 'module') {
    pkg.type = 'module';
    msgs.push('package.json: thêm "type": "module".');
  }

  const JEST_CMD = 'node --experimental-vm-modules node_modules/jest/bin/jest.js';
  for (const [key, val] of Object.entries(pkg.scripts || {})) {
    if (typeof val === 'string' && /(^|\s|&&\s*)jest(\s|$)/.test(val) && !val.includes('experimental-vm-modules')) {
      pkg.scripts[key] = val.replace(/(^|\s|&&\s*)jest(\s|$)/, `$1${JEST_CMD}$2`);
      msgs.push(`package.json: script "${key}" chạy Jest ở chế độ ESM.`);
    }
  }

  const hasJestConfigFile = fs.readdirSync(ROOT).some((f) => /^jest\.config\./.test(f));
  if (!hasJestConfigFile) {
    pkg.jest = { testEnvironment: 'node', ...(pkg.jest || {}), transform: {} };
    msgs.push('package.json: cấu hình Jest với transform: {} (không dùng Babel).');
  } else {
    msgs.push('Có file jest.config.*: hãy chắc chắn nó có "transform: {}".');
  }

  if (!DRY) fs.writeFileSync(file, JSON.stringify(pkg, null, indent) + EOL);
  return msgs;
};

const updateGeminiMd = () => {
  const file = path.join(ROOT, 'GEMINI.md');
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const next = raw.replace(
    /\(CommonJS hoặc ESM, chọn một và giữ nhất quán\)/,
    '(ES Modules: dùng import/export, package.json có "type": "module"; import tương đối phải ghi đuôi .js)'
  );
  if (next === raw) return [];
  if (!DRY) fs.writeFileSync(file, next);
  return ['GEMINI.md: ghi rõ dự án dùng ES Modules.'];
};

const files = [];
for (const t of userTargets.length ? userTargets : DEFAULT_TARGETS) collect(t, files);

console.log(`${DRY ? '[CHẠY THỬ - không ghi file] ' : ''}Tìm thấy ${files.length} file .js\n`);

let changedCount = 0;
let needManual = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, 'utf8');
  const { code, notes, changed } = convert(src, f);
  if (!changed && notes.length === 0) continue;

  if (changed) {
    changedCount += 1;
    if (!DRY) fs.writeFileSync(f, code);
    console.log(`✔ ${rel}`);
  }
  if (notes.length > 0) {
    needManual += 1;
    for (const n of notes) console.log(`   ⚠ ${n}`);
  }
}

console.log('');
for (const m of [...updatePackageJson(), ...updateGeminiMd()]) console.log(`✔ ${m}`);

console.log(`\nXong: ${changedCount} file được chuyển, ${needManual} file có cảnh báo cần xem.`);
if (DRY) console.log('Đây là chạy thử. Bỏ --dry để chuyển đổi thật.');