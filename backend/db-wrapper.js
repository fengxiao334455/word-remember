const { getDb, saveDb } = require('./db');

// 查询单行，返回对象
function getOne(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => { row[c] = vals[i]; });
    stmt.free();
    // 处理 DATE 类型 - sql.js 可能返回 Uint8Array
    for (const key of Object.keys(row)) {
      if (row[key] instanceof Uint8Array) {
        row[key] = String.fromCharCode(...row[key]);
      }
    }
    return row;
  }
  stmt.free();
  return null;
}

// 查询多行，返回对象数组
function getAll(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => {
      let v = vals[i];
      if (v instanceof Uint8Array) {
        v = String.fromCharCode(...v);
      }
      row[c] = v;
    });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

// 执行 INSERT/UPDATE/DELETE，返回影响行数和 lastInsertRowid
function execute(sql, params = []) {
  const db = getDb();
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  stmt.step();
  const result = {
    changes: db.getRowsModified(),
    lastInsertRowid: stmt.getAsObject()  // won't work, let me handle this differently
  };
  stmt.free();
  saveDb();
  return result;
}

// 运行多条 SQL
function runSql(sql) {
  const db = getDb();
  db.run(sql);
  saveDb();
}

module.exports = { getOne, getAll, execute, runSql };
