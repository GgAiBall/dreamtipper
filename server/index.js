const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 调试 endpoint（临时）
app.get('/api/_dbg_run', async (req, res) => {
  const { run, queryOne } = require('./db');
  const tag = 'DBG_' + Date.now();
  const ok = await run('INSERT INTO sweep_records (id, league, home_team, away_team, match_time, handicap, status, tier_required, match_no, weekday, confidence_stars, uploaded_by, odds, odds_type, result, match_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [tag, 'Debug', 'D-H', 'D-A', new Date().toISOString(), '[]', 'pending', 'free', tag, 6, 3, 'admin-001', 1.5, '胜平负', 'pending', tag]);
  const found = await queryOne('SELECT id, home_team FROM sweep_records WHERE id=?', [tag]);
  res.json({ ok, tag, found });
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

  // 托管前端静态文件（client/dist）
  const clientDist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback: 任何非 /api 路径都返回 index.html（让 Vue Router 处理）
    app.get(/^(?!\/api).*/, async (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
    console.log(`📦 前端静态文件托管于: ${clientDist}`);
  } else {
    console.log(`⚠️ 未找到前端构建目录 ${clientDist}（仅 API 服务模式）`);
  }

  app.listen(PORT, () => {
    console.log(`🏃 服务器运行中 → http://localhost:${PORT}`);
    console.log(`🔑 默认管理员 → admin@dreamtipper.com / admin123`);
  });
}

start().catch(console.error);
