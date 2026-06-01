const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// 获取单词列表（分页）
router.get('/', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const listType = req.query.list_type || '';
  const offset = (page - 1) * limit;

  let where = '';
  const params = [];

  if (listType) {
    where = ' WHERE list_type = $1';
    params.push(listType);
  }

  const words = await db.all(
    `SELECT * FROM words${where} ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const totalRow = await db.get(
    `SELECT COUNT(*) as total FROM words${where}`,
    params
  );

  res.json({ words, total: totalRow ? parseInt(totalRow.total) : 0, page, limit });
});

// 获取学习新词
router.get('/learn', authMiddleware, async (req, res) => {
  const count = parseInt(req.query.count) || 10;

  const todayNew = await db.get(
    `SELECT COUNT(*) as cnt FROM user_progress
     WHERE user_id = $1 AND last_reviewed::date = CURRENT_DATE`,
    [req.userId]
  );

  const maxNew = 20;
  const remaining = Math.min(maxNew - (todayNew ? parseInt(todayNew.cnt) : 0), count);

  if (remaining <= 0) {
    return res.json({ words: [], daily_done: true });
  }

  const words = await db.all(
    `SELECT w.* FROM words w
     LEFT JOIN user_progress up ON w.id = up.word_id AND up.user_id = $1
     WHERE up.id IS NULL
     ORDER BY w.difficulty ASC, w.id ASC
     LIMIT $2`,
    [req.userId, remaining]
  );

  // 批量创建学习记录
  if (words.length > 0) {
    const values = words.map((_, i) => `($$1, $${2 + i})`).join(', ');
    await db.run(
      `INSERT INTO user_progress (user_id, word_id, stage, next_review)
       VALUES ${values}
       ON CONFLICT DO NOTHING`,
      [req.userId, ...words.map(w => w.id)]
    );
  }

  res.json({ words, daily_done: false });
});

// 搜索单词
router.get('/search', authMiddleware, async (req, res) => {
  const q = req.query.q || '';
  if (!q.trim()) return res.json({ words: [] });

  const words = await db.all(
    `SELECT w.*, up.stage, up.is_learned
     FROM words w
     LEFT JOIN user_progress up ON w.id = up.word_id AND up.user_id = $1
     WHERE w.word ILIKE $2 OR w.translation ILIKE $3
     ORDER BY w.id LIMIT 30`,
    [req.userId, `%${q}%`, `%${q}%`]
  );

  res.json({ words });
});

module.exports = router;
