const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动
async function start() {
  await initDb();

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/sweep', require('./routes/sweep'));
  app.use('/api/plans', require('./routes/plans'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/purchases', require('./routes/purchases'));

  app.listen(PORT, () => {
    console.log(`🏃 服务器运行中 → http://localhost:${PORT}`);
    console.log(`🔐 管理员后台入口 → http://localhost:5173/admin`);
    console.log(`🔑 默认管理员 → admin@dreamtipper.com / admin123`);
  });
}

start().catch(console.error);
