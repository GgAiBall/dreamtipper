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

  // 托管前端静态文件（client/dist）
  // Render 部署时通过 build 命令先生成 client/dist
  const clientDist = path.resolve(__dirname, '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback: 任何非 /api 路径都返回 index.html（让 Vue Router 处理）
    app.get(/^(?!\/api).*/, (req, res) => {
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