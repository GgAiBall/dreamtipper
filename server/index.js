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

// 启动
async function start() {
  await initDb();

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/sweep', require('./routes/sweep'));
  app.use('/api/plans', require('./routes/plans'));
  app.use('/api/stats', require('./routes/stats'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/purchases', require('./routes/purchases'));
  app.use('/api/analysis', require('./routes/analysis'));
  app.use('/api/football', require('./routes/football'));

  // 竞彩赛程自动同步接口（手动触发 / 供 cron 调用）
  const checkSyncAuth = (req) => {
    const token = req.headers.authorization || '';
    const syncKey = req.headers['x-sync-key'] || '';
    return token === `Bearer ${process.env.JWT_SECRET || 'dreamtipper-secret-key-2024'}`
        || syncKey === (process.env.SYNC_KEY || 'dt-sync-2026');
  };
  app.post('/api/sync/sporttery', async (req, res) => {
    if (!checkSyncAuth(req)) return res.status(401).json({ error: '未授权' });
    try {
      const { runSync } = require('./syncScheduler');
      const result = await runSync({ dryRun: false });
      res.json(result);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sync/sporttery', async (req, res) => {
    if (!checkSyncAuth(req)) return res.status(401).json({ error: '未授权' });
    try {
      const { runSync } = require('./syncScheduler');
      const result = await runSync({ dryRun: true });
      res.json(result);
    } catch(e) {
      res.status(500).json({ error: e.message });
    }
  });

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
