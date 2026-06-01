const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 静态文件 - 前端
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/words', require('./routes/words'));
app.use('/api/progress', require('./routes/progress'));

// 前端 SPA 路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=== 高考英语单词学习网站 ===`);
    console.log(`本地访问: http://localhost:${PORT}`);
    console.log(`手机访问: http://本机IP地址:${PORT}`);
    console.log(`按 Ctrl+C 停止服务器`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
});
