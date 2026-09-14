const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'dreamtipper.db');

let db = null;

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (e) { console.error('保存数据库失败:', e.message); }
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  } catch (e) {
    console.error('Query error:', e.message);
    return [];
  }
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    saveDb();
    return true;
  } catch (e) {
    console.error('Run error:', e.message);
    return false;
  }
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
      console.log('✅ 数据库加载成功');
      return;
    } catch (e) {
      console.log('⚠️ 数据库文件损坏，将重新创建');
    }
  }
  db = new SQL.Database();

  db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '', role TEXT DEFAULT 'user', subscription_tier TEXT DEFAULT 'free', subscription_expire TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, price INTEGER DEFAULT 0, tier_required TEXT DEFAULT 'free', stats TEXT DEFAULT '{"total":0,"wins":0,"losses":0,"pushes":0}', subscriber_count INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS sweep_records (id TEXT PRIMARY KEY, match_id TEXT, league TEXT, home_team TEXT NOT NULL, away_team TEXT NOT NULL, match_time TEXT NOT NULL, handicap TEXT, odds REAL, odds_type TEXT, confidence_stars INTEGER DEFAULT 3, tier_required TEXT DEFAULT 'free', result TEXT DEFAULT 'pending', status TEXT DEFAULT 'pending', uploaded_by TEXT, published_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS recommendations (id TEXT PRIMARY KEY, plan_id TEXT, sweep_record_id TEXT, title TEXT, content TEXT, published_at TEXT DEFAULT (datetime('now')), result TEXT DEFAULT 'pending', profit REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS user_purchases (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, plan_id TEXT, type TEXT DEFAULT 'unlock', amount INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', paid_at TEXT, expire_at TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS daily_stats (id TEXT PRIMARY KEY, date TEXT UNIQUE NOT NULL, total_recommendations INTEGER DEFAULT 0, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, pushes INTEGER DEFAULT 0, win_rate REAL DEFAULT 0, profit_rate REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);

  db.run(`CREATE TABLE IF NOT EXISTS admin_logs (id TEXT PRIMARY KEY, user_id TEXT, action TEXT, detail TEXT, created_at TEXT DEFAULT (datetime('now')))`);

  // 管理员
  const adminExists = queryOne("SELECT id FROM users WHERE role = 'admin'");
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT INTO users (id, email, password_hash, nickname, role, subscription_tier) VALUES (?, ?, ?, ?, ?, ?)`,
      ['admin-001', 'admin@dreamtipper.com', hash, '梦幻竞彩家', 'admin', 'yearly']);
    console.log('✅ 默认管理员: admin@dreamtipper.com / admin123');
  }

  // 方案
  const planCount = queryOne("SELECT COUNT(*) as c FROM plans");
  if (!planCount || planCount.c === 0) {
    db.run(`INSERT INTO plans (id, name, description, price, tier_required) VALUES (?, ?, ?, ?, ?)`, ['plan-free-01', '免费扫盘', '每日基础扫盘数据', 0, 'free']);
    db.run(`INSERT INTO plans (id, name, description, price, tier_required) VALUES (?, ?, ?, ?, ?)`, ['plan-monthly-01', '月度精选', '月度精选推荐方案，附详细分析', 19900, 'monthly']);
    db.run(`INSERT INTO plans (id, name, description, price, tier_required) VALUES (?, ?, ?, ?, ?)`, ['plan-yearly-01', '年度黄金', '年度会员专属，含全部高级方案', 99900, 'yearly']);
    console.log('✅ 默认方案已创建');
  }

  // 示例数据
  const sweepCount = queryOne("SELECT COUNT(*) as c FROM sweep_records");
  if (!sweepCount || sweepCount.c === 0) {
    initSampleData();
    console.log('✅ 示例扫盘数据已初始化');
  }

  saveDb();
  console.log('✅ 数据库初始化完成');
}

function initSampleData() {
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
      db.run(`INSERT INTO sweep_records (id, match_id, league, home_team, away_team, match_time, handicap, odds, odds_type, confidence_stars, tier_required, result, status, uploaded_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, `match-${id}`, league, home, away, matchTime, handicap, parseFloat(odds), oddsType, stars, tier, result, status, 'admin-001', published_at]);
    }

    const total = dayWins + dayLosses + dayPushes;
    if (total > 0) {
      const winRate = ((dayWins + dayPushes * 0.5) / total * 100).toFixed(1);
      const profitRate = ((dayWins - dayLosses) / total * 100).toFixed(1);
      db.run(`INSERT INTO daily_stats (id, date, total_recommendations, wins, losses, pushes, win_rate, profit_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`daily-${dateStr}`, dateStr, total, dayWins, dayLosses, dayPushes, parseFloat(winRate), parseFloat(profitRate)]);
    }
  }

  const allRecs = queryAll("SELECT id, result, published_at FROM sweep_records WHERE status = 'settled' LIMIT 50");
  allRecs.slice(0, 30).forEach((rec, i) => {
    const profit = rec.result === 'win' ? 0.8 : (rec.result === 'push' ? 0 : -1);
    db.run(`INSERT INTO recommendations (id, plan_id, sweep_record_id, title, content, published_at, result, profit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`rec-${Date.now()}-${i}`, 'plan-monthly-01', rec.id, `推荐方案 #${i + 1}`, '本场基于历史数据和近期状态综合分析得出', rec.published_at, rec.result, profit]);
  });
}

module.exports = { initDb, queryAll, queryOne, run, saveDb };
