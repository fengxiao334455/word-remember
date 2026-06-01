const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const INTERVALS = [0, 1, 3, 7, 14, 30];

// 获取今天需要复习的单词
router.get('/review', authMiddleware, async (req, res) => {
  const count = parseInt(req.query.count) || 15;

  const words = await db.all(
    `SELECT w.*, up.stage, up.correct_count, up.incorrect_count,
            up.is_learned, up.last_reviewed
     FROM words w
     JOIN user_progress up ON w.id = up.word_id
     WHERE up.user_id = $1
       AND up.next_review <= CURRENT_DATE
       AND up.is_learned = 0
     ORDER BY up.next_review ASC, up.stage ASC
     LIMIT $2`,
    [req.userId, count]
  );

  res.json({ words });
});

// 提交复习结果
router.post('/review', authMiddleware, async (req, res) => {
  const { wordId, correct } = req.body;
  if (!wordId) return res.status(400).json({ error: '缺少单词ID' });

  const progress = await db.get(
    'SELECT * FROM user_progress WHERE user_id = $1 AND word_id = $2',
    [req.userId, wordId]
  );

  if (!progress) return res.status(404).json({ error: '学习记录不存在' });

  let stage = progress.stage;
  let isLearned = progress.is_learned;

  if (correct) {
    stage = Math.min(Number(stage) + 1, 5);
    if (stage >= 5) isLearned = 1;
  } else {
    stage = Math.max(Number(stage) - 1, 0);
    isLearned = 0;
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + INTERVALS[stage]);
  const nextReviewStr = nextReview.toISOString().split('T')[0];

  await db.run(
    `UPDATE user_progress SET
       stage = $1, next_review = $2,
       correct_count = correct_count + $3,
       incorrect_count = incorrect_count + $4,
       is_learned = $5, last_reviewed = NOW()
     WHERE user_id = $6 AND word_id = $7`,
    [stage, nextReviewStr, correct ? 1 : 0, correct ? 0 : 1, isLearned, req.userId, wordId]
  );

  // 更新每日统计
  const today = new Date().toISOString().split('T')[0];
  await db.run(
    `INSERT INTO daily_stats (user_id, date, reviewed_words, correct_count, incorrect_count)
     VALUES ($1, $2, 1, $3, $4)
     ON CONFLICT (user_id, date) DO UPDATE SET
       reviewed_words = daily_stats.reviewed_words + 1,
       correct_count = daily_stats.correct_count + $5,
       incorrect_count = daily_stats.incorrect_count + $6`,
    [req.userId, today, correct ? 1 : 0, correct ? 0 : 1, correct ? 1 : 0, correct ? 0 : 1]
  );

  res.json({ success: true, stage, is_learned: isLearned, next_review: nextReviewStr });
});

// 标记单词已学习
router.post('/learned', authMiddleware, async (req, res) => {
  const { wordId, correct } = req.body;
  if (!wordId) return res.status(400).json({ error: '缺少单词ID' });

  const existing = await db.get(
    'SELECT id FROM user_progress WHERE user_id = $1 AND word_id = $2',
    [req.userId, wordId]
  );

  if (existing) {
    return res.json({ success: true });
  }

  const stage = correct ? 1 : 0;
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + INTERVALS[stage]);
  const nextReviewStr = nextReview.toISOString().split('T')[0];

  await db.run(
    `INSERT INTO user_progress (user_id, word_id, stage, next_review, correct_count, incorrect_count, is_learned, last_reviewed)
     VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())`,
    [req.userId, wordId, stage, nextReviewStr, correct ? 1 : 0, correct ? 0 : 1]
  );

  const today = new Date().toISOString().split('T')[0];
  await db.run(
    `INSERT INTO daily_stats (user_id, date, new_words, correct_count, incorrect_count)
     VALUES ($1, $2, 1, $3, $4)
     ON CONFLICT (user_id, date) DO UPDATE SET
       new_words = daily_stats.new_words + 1,
       correct_count = daily_stats.correct_count + $5,
       incorrect_count = daily_stats.incorrect_count + $6`,
    [req.userId, today, correct ? 1 : 0, correct ? 0 : 1, correct ? 1 : 0, correct ? 0 : 1]
  );

  res.json({ success: true, stage, next_review: nextReviewStr });
});

// 获取学习统计
router.get('/stats', authMiddleware, async (req, res) => {
  const totalRow = await db.get('SELECT COUNT(*) as cnt FROM words');
  const totalWords = totalRow ? parseInt(totalRow.cnt) : 0;

  const learnedRow = await db.get('SELECT COUNT(*) as cnt FROM user_progress WHERE user_id = $1', [req.userId]);
  const learnedWords = learnedRow ? parseInt(learnedRow.cnt) : 0;

  const masteredRow = await db.get(
    'SELECT COUNT(*) as cnt FROM user_progress WHERE user_id = $1 AND stage >= 4',
    [req.userId]
  );
  const masteredWords = masteredRow ? parseInt(masteredRow.cnt) : 0;

  const reviewRow = await db.get(
    `SELECT COUNT(*) as cnt FROM user_progress
     WHERE user_id = $1 AND next_review <= CURRENT_DATE AND is_learned = 0`,
    [req.userId]
  );
  const todayReview = reviewRow ? parseInt(reviewRow.cnt) : 0;

  // 连续学习天数
  const activeDates = await db.all(
    'SELECT DISTINCT date FROM daily_stats WHERE user_id = $1 ORDER BY date DESC',
    [req.userId]
  );

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  let checkDate = today;

  for (const row of activeDates) {
    if (row.date === checkDate) {
      streak++;
      const d = new Date(checkDate);
      d.setDate(d.getDate() - 1);
      checkDate = d.toISOString().split('T')[0];
    } else if (row.date < checkDate) {
      break;
    }
  }

  // 近7日学习数据
  const weeklyStats = await db.all(
    `SELECT date, new_words, reviewed_words, correct_count, incorrect_count
     FROM daily_stats
     WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'
     ORDER BY date`,
    [req.userId]
  );

  // 各词库进度
  const listProgress = await db.all(
    `SELECT
       w.list_type,
       COUNT(*) as total,
       SUM(CASE WHEN up.id IS NOT NULL THEN 1 ELSE 0 END) as learned,
       SUM(CASE WHEN up.stage >= 4 THEN 1 ELSE 0 END) as mastered
     FROM words w
     LEFT JOIN user_progress up ON w.id = up.word_id AND up.user_id = $1
     GROUP BY w.list_type`,
    [req.userId]
  );

  res.json({
    total_words: totalWords,
    learned_words: learnedWords,
    mastered_words: masteredWords,
    today_review: todayReview,
    streak,
    weekly_stats: weeklyStats,
    list_progress: listProgress
  });
});

// 获取所有已学单词
router.get('/learned-words', authMiddleware, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const listType = req.query.list_type || '';

  let where = 'WHERE up.user_id = $1';
  const params = [req.userId];

  if (listType) {
    where += ' AND w.list_type = $2';
    params.push(listType);
  }

  const words = await db.all(
    `SELECT w.*, up.stage, up.correct_count, up.incorrect_count,
            up.is_learned, up.next_review, up.last_reviewed
     FROM user_progress up
     JOIN words w ON w.id = up.word_id
     ${where}
     ORDER BY up.last_reviewed DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, (page - 1) * limit]
  );

  const totalRow = await db.get(
    `SELECT COUNT(*) as total FROM user_progress up
     JOIN words w ON w.id = up.word_id
     ${where}`,
    params
  );

  res.json({ words, total: totalRow ? parseInt(totalRow.total) : 0, page, limit });
});

module.exports = router;
