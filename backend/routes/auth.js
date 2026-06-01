const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需在2-20个字符之间' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少4个字符' });
  }

  try {
    const existing = await db.get('SELECT id FROM users WHERE username = $1', [username]);
    if (existing) {
      return res.status(400).json({ error: '用户名已被使用' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = await db.get(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, hash]
    );
    const token = generateToken(result.id);

    res.json({ token, user: { id: result.id, username } });
  } catch (err) {
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const user = await db.get('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
  if (!user) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: '用户名或密码错误' });
  }

  await db.run('UPDATE users SET last_active = CURRENT_DATE WHERE id = $1', [user.id]);
  const token = generateToken(user.id);

  res.json({ token, user: { id: user.id, username: user.username } });
});

router.get('/profile', authMiddleware, async (req, res) => {
  const user = await db.get('SELECT id, username, created_at, last_active FROM users WHERE id = $1', [req.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

module.exports = router;
