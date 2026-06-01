const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/word_remember',
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      last_active DATE DEFAULT CURRENT_DATE
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS words (
      id SERIAL PRIMARY KEY,
      word TEXT NOT NULL,
      translation TEXT NOT NULL,
      phonetic TEXT DEFAULT '',
      example_sentence TEXT DEFAULT '',
      example_translation TEXT DEFAULT '',
      difficulty INTEGER DEFAULT 1,
      list_type TEXT DEFAULT 'gaokao',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_progress (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      word_id INTEGER NOT NULL REFERENCES words(id),
      stage INTEGER DEFAULT 0,
      next_review DATE DEFAULT CURRENT_DATE,
      correct_count INTEGER DEFAULT 0,
      incorrect_count INTEGER DEFAULT 0,
      last_reviewed TIMESTAMP,
      is_learned INTEGER DEFAULT 0,
      UNIQUE(user_id, word_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      date DATE NOT NULL,
      new_words INTEGER DEFAULT 0,
      reviewed_words INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      incorrect_count INTEGER DEFAULT 0,
      study_minutes INTEGER DEFAULT 0,
      UNIQUE(user_id, date)
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_progress_review ON user_progress(user_id, next_review)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_stats_user_date ON daily_stats(user_id, date)');

  // 自动种子数据
  await autoSeed();
}

async function autoSeed() {
  const { rows } = await pool.query('SELECT COUNT(*) as cnt FROM words');
  if (parseInt(rows[0].cnt) > 0) return;

  const words = require('./words.json');
  for (const w of words) {
    await pool.query(
      `INSERT INTO words (word, translation, phonetic, example_sentence, example_translation, difficulty, list_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [w.w, w.t, w.p || '', w.e || '', w.et || '', w.d || 1, w.l || 'gaokao']
    );
  }
  console.log(`自动导入了 ${words.length} 个单词`);
}

async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function run(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rowCount;
}

module.exports = { initDb, get, all, run, pool };
