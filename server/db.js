const { createClient } = require('@libsql/client');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'dreamtipper.db');

// 连接方式（env 驱动）：
//   1) 生产：TURSO_DATABASE_URL (libsql:// 或 https://) + TURSO_AUTH_TOKEN  -> Turso 云数据库（持久）
//   2) 本地：不设 env 时回退到 file: ./dreamtipper.db（原生 SQLite 文件，与 sql.js 同格式）
const TURSO_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || '';

const url = TURSO_URL || `file:${DB_PATH}`;
const authToken = TURSO_TOKEN || undefined;
const IS_REMOTE = /^(libsql|https?|wss?):/i.test(url);

const db = createClient({ url, authToken });

function where() {
  if (IS_REMOTE) {
    return TURSO_URL.replace(/\/+$/, '').replace(/^(libsql|https?|wss?):\/\//i, '$1://***');
  }
  return url;
}

async function queryAll(sql, params = []) {
  try {
    const res = await db.execute({ sql, args: params });
    return res.rows.map((r) => ({ ...r }));
  } catch (e) {
    console.error('Query error:', e.message);
    return [];
  }
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows[0] || null;
}

async function run(sql, params = []) {
  try {
    await db.execute({ sql, args: params });
    return true;
  } catch (e) {
    console.error('Run error:', e.message);
    return false;
  }
}

// 兼容旧接口：远端/文件库都会自动持久化，无需手动落盘
async function saveDb() {
  return true;
}

async function initDb() {
  console.log(`🔌 数据库连接: ${where()} (${IS_REMOTE ? 'Turso 远端' : '本地文件'})`);

  await db.execute(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', role TEXT DEFAULT 'user', subscription_tier TEXT DEFAULT 'free', subscription_expire TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  await db.execute(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price INTEGER DEFAULT 0, tier_required TEXT DEFAULT 'free', stats TEXT DEFAULT '{"total":0,"wins":0,"losses":0,"pushes":0}', subscriber_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  await db.execute(`CREATE TABLE IF NOT EXISTS sweep_records (id TEXT PRIMARY KEY, match_id TEXT, league TEXT, home_team TEXT NOT NULL, away_team TEXT NOT NULL, match_time TEXT NOT NULL, handicap TEXT, odds REAL, odds_type TEXT, confidence_stars INTEGER DEFAULT 3, tier_required TEXT DEFAULT 'free', result TEXT DEFAULT 'pending', status TEXT DEFAULT 'pending', uploaded_by TEXT, weekday INTEGER, match_no TEXT, published_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  await db.execute(`CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, plan_id TEXT, sweep_record_id TEXT, title TEXT, content TEXT, published_at TEXT DEFAULT (datetime('now')), result TEXT DEFAULT 'pending', profit REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  await db.execute(`CREATE TABLE IF NOT EXISTS user_purchases (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan_id TEXT, type TEXT DEFAULT 'unlock', amount INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', paid_at TEXT, expire_at TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  await db.execute(`CREATE TABLE IF NOT EXISTS daily_stats (id TEXT PRIMARY KEY, date TEXT UNIQUE NOT NULL, total_recommendations INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, pushes INTEGER DEFAULT 0, win_rate REAL DEFAULT 0, profit_rate REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);

  await db.execute(`CREATE TABLE IF NOT EXISTS admin_logs (id TEXT PRIMARY KEY, user_id TEXT, action TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  // 用户解锁记录表（免费用户每日 3 次解锁会员场次的记录）
  await db.execute(`CREATE TABLE IF NOT EXISTS user_unlocks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, sweep_id TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')), UNIQUE(user_id, sweep_id))`);

  // 实时分析文章（管理员上传，前台实时分析界面展示）
  await db.execute(`CREATE TABLE IF NOT EXISTS analysis_posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT DEFAULT '实时分析', content TEXT DEFAULT '', image_url TEXT, tier_required TEXT DEFAULT 'free', created_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  // sweep_records 新增字段（详情页链接 / 分类 / 数据来源）
  try { await db.execute(`ALTER TABLE sweep_records ADD COLUMN detail_url TEXT`); } catch (e) {}
  try { await db.execute(`ALTER TABLE sweep_records ADD COLUMN category TEXT DEFAULT '人工扫盘'`); } catch (e) {}
  try { await db.execute(`ALTER TABLE sweep_records ADD COLUMN data_source TEXT DEFAULT 'system'`); } catch (e) {}
  // 官网比赛结果（自动获取后写入）
  try { await db.execute(`ALTER TABLE sweep_records ADD COLUMN official_result TEXT`); } catch (e) {}
  // plans 加 is_active 字段（plan 默认线上）
  try { await db.execute(`ALTER TABLE plans ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (e) {}

  // 每日解锁计数列（try 防已存在时 ALTER 报错）
  try { await db.execute(`ALTER TABLE users ADD COLUMN unlock_used_today INTEGER DEFAULT 0`); } catch (e) {}
  try { await db.execute(`ALTER TABLE users ADD COLUMN unlock_date TEXT`); } catch (e) {}

  // 管理员
  const adminExists = await queryOne("SELECT id FROM users WHERE role = 'admin'");
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, nickname, role, subscription_tier) VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['admin-001', 'admin@dreamtipper.com', hash, '梦幻竞彩家', 'admin', 'yearly']
    });
    console.log('✅ 默认管理员: admin@dreamtipper.com / admin123');
  }

  // 方案
  const planCount = await queryOne("SELECT COUNT(*) as c FROM plans");
  if (!planCount || Number(planCount.c) === 0) {
    await db.execute({ sql: `INSERT INTO plans (id, name, description, price, tier_required) VALUES (?, ?, ?, ?, ?)`, args: ['plan-free-01', '免费扫盘', '每日基础扫盘数据', 0, 'free'] });
    await db.execute({ sql: `INSERT INTO plans (id, name, description, price, tier_required) VALUES (?, ?, ?, ?, ?)`, args: ['plan-monthly-01', '月度精选', '月度精选推荐方案，附详细分析', 19900, 'monthly'] });
    await db.execute({ sql: `INSERT INTO plans (id, name, description, price, tier_required) VALUES (?, ?, ?, ?, ?)`, args: ['plan-yearly-01', '年度黄金', '年度会员专属，含全部高级方案', 99900, 'yearly'] });
    console.log('✅ 默认方案已创建');
  }

  // 示例数据（仅在空库且未禁用时）
  const sweepCount = await queryOne("SELECT COUNT(*) as c FROM sweep_records");
  if ((!sweepCount || Number(sweepCount.c) === 0) && process.env.SKIP_SAMPLE_SEED !== 'true') {
    await initSampleData();
    console.log('✅ 示例扫盘数据已初始化');
  }

  console.log('✅ 数据库初始化完成');
}

async function initSampleData() {
  const leagues = ['英超', '西甲', '意甲', '德甲', '法甲', '欧冠', '中超', '日职', '韩K', 'NBA', 'CBA'];
  const teams = ['曼城', '阿森纳', '曼联', '利物浦', '皇马', '巴萨', '马竞', '尤文图斯', 'AC米兰', '国际米兰', '拜仁', '多特蒙德', '巴黎圣日耳曼', '马赛', '上海海港', '上海申花', '山东泰山', '北京国安', '川崎前锋', '横滨水手', '全北现代', '蔚山现代', '湖人', '勇士', '凯尔特人', '雄鹿', '广东', '辽宁', '浙江', '广厦', '深圳'];
  const oddsTypes = ['胜平负', '让球胜平负', '大小球', '比分'];
  const handicaps = ['0', '-0.5', '-1', '-1.5', '+0.5', '+1', '2.5大', '2.5小', '3大'];

  const now = new Date();

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    const matchCount = 3 + Math.floor(Math.random() * 6);
    let dayWins = 0, dayLosses = 0, dayPushes = 0;

    for (let i = 0; i < matchCount; i++) {
      const id = `sweep-${dateStr}-${i.toString().padStart(2, '0')}`;
      const weekday = new Date(dateStr + 'T00:00:00').getDay();
      const matchNo = (i + 1).toString().padStart(3, '0');
      const league = leagues[Math.floor(Math.random() * leagues.length)];
      const home = teams[Math.floor(Math.random() * teams.length)];
      let away = teams[Math.floor(Math.random() * teams.length)];
      while (away === home) away = teams[Math.floor(Math.random() * teams.length)];
      const matchHour = 15 + Math.floor(Math.random() * 7);
      const matchMinute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
      const matchTime = `${dateStr}T${matchHour.toString().padStart(2, '0')}:${matchMinute.toString().padStart(2, '0')}:00`;
      const oddsType = oddsTypes[Math.floor(Math.random() * oddsTypes.length)];
      const handicap = handicaps[Math.floor(Math.random() * handicaps.length)];
      const odds = (1.5 + Math.random() * 3).toFixed(2);
      const stars = Math.ceil(Math.random() * 5);
      const tier = stars >= 4 ? 'monthly' : 'free';
      const accuracy = 0.4 + stars * 0.08;
      const rand = Math.random();
      let result = 'pending', status = dayOffset <= 3 ? 'pending' : 'settled';
      if (dayOffset > 3) {
        if (rand < accuracy * 0.85) { result = 'win'; dayWins++; }
        else if (rand < accuracy) { result = 'push'; dayPushes++; }
        else { result = 'loss'; dayLosses++; }
      }
      const published_at = `${dateStr} ${(14 + Math.floor(Math.random() * 2)).toString().padStart(2, '0')}:00:00`;
      await db.execute({
        sql: `INSERT INTO sweep_records (id, match_id, league, home_team, away_team, match_time, handicap, odds, odds_type, confidence_stars, tier_required, result, status, uploaded_by, weekday, match_no, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, `match-${id}`, league, home, away, matchTime, handicap, parseFloat(odds), oddsType, stars, tier, result, status, 'admin-001', weekday, matchNo, published_at]
      });
    }

    const total = dayWins + dayLosses + dayPushes;
    if (total > 0) {
      const winRate = ((dayWins + dayPushes * 0.5) / total * 100).toFixed(1);
      const profitRate = ((dayWins - dayLosses) / total * 100).toFixed(1);
      await db.execute({
        sql: `INSERT INTO daily_stats (id, date, total_recommendations, wins, losses, pushes, win_rate, profit_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [`daily-${dateStr}`, dateStr, total, dayWins, dayLosses, dayPushes, parseFloat(winRate), parseFloat(profitRate)]
      });
    }
  }

  const allRecs = await queryAll("SELECT id, result, published_at FROM sweep_records WHERE status = 'settled' LIMIT 50");
  const picks = allRecs.slice(0, 30);
  for (let i = 0; i < picks.length; i++) {
    const rec = picks[i];
    const profit = rec.result === 'win' ? 0.8 : (rec.result === 'push' ? 0 : -1);
    await db.execute({
      sql: `INSERT INTO recommendations (id, plan_id, sweep_record_id, title, content, published_at, result, profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [`rec-${Date.now()}-${i}`, 'plan-monthly-01', rec.id, `推荐方案 #${i + 1}`, '本场基于历史数据和近期状态综合分析得出', rec.published_at, rec.result, profit]
    });
  }
}

module.exports = { initDb, queryAll, queryOne, run, saveDb };
