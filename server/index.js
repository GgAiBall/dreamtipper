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

// [TEMP DEBUG] 诊断竞彩接口从 Render 的可达性
app.get('/api/_dbg_sporttery', async (req, res) => {
  const https = require('https');
  const url = 'https://webapi.sporttery.cn/gateway/uniform/fb/getMatchLiveV1.qry?matchIds=&eventTc=goals,penalty_shootout&method=live';
  try {
    const u = new URL(url);
    const r = https.request({ method: 'GET', hostname: u.hostname, path: u.pathname + u.search, timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*', 'Referer': 'https://m.sporttery.cn/' } }, resp => {
      const c = []; resp.on('data', d => c.push(d)); resp.on('end', () => {
        const buf = Buffer.concat(c);
        let j = null; try { j = JSON.parse(buf.toString('utf8')); } catch (e) {}
        res.json({ status: resp.statusCode, len: buf.length, parseOk: !!j, valueType: j && j.value ? (Array.isArray(j.value) ? 'array[' + j.value.length + ']' : typeof j.value) : 'null', firstMatchNum: j && Array.isArray(j.value) && j.value[0] ? j.value[0].matchNum : null, head: buf.toString('utf8').slice(0, 150) });
      });
    });
    r.on('error', e => res.json({ error: e.message })); r.on('timeout', () => { r.destroy(); res.json({ error: 'timeout' }); }); r.end();
  } catch (e) { res.json({ error: e.message }); }
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
