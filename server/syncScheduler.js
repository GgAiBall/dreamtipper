// syncScheduler.js —— 每日自动从竞彩官网拉取赛程数据，写入扫盘记录（不写结果）
// 核心逻辑：
//   1. 调用 getMatchListV1.qry 获取今日在售比赛（含未来几天）
//   2. 遍历所有分组，按 matchNum 查重（DB 已存在则跳过）
//   3. 只 INSERT 新记录，status=pending，result=null，不动已有数据
// 调用方式：node syncScheduler.js [--dry-run]

const https = require('https');
const http = require('http');
const path = require('path');
const fs = require('fs');

// 加载 db（异步初始化）
const DB_PATH = path.join(__dirname, 'dreamtipper.db');

let db = null;
async function initLocalDb() {
  const initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  db = new SQL.Database();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db.run('ATTACH DATABASE ? AS remote', [buf]);
    // 复制到本地
    const data = buf;
    db = new SQL.Database(data);
  }
  return db;
}

const SPORTTERY_LIST_URL = 'https://webapi.sporttery.cn/gateway/uniform/football/getMatchListV1.qry?clientCode=3001';

function resolveUrl(base) {
  const proxy = process.env.RESULT_PROXY_URL || '';
  if (!proxy) return base;
  return proxy + (proxy.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(base);
}

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve(null); }
    const opt = {
      method: 'GET', hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, timeout: timeoutMs || 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15', 'Accept': 'application/json,*/*', 'Referer': 'https://m.sporttery.cn/' },
    };
    const lib = u.protocol === 'http:' ? http : https;
    const r = lib.request(opt, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => {
        let j; try { j = JSON.parse(Buffer.concat(c).toString('utf8')); } catch (e) { j = null; }
        resolve(j);
      });
    });
    r.on('error', () => resolve(null));
    r.on('timeout', () => { r.destroy(); resolve(null); });
    r.end();
  });
}

// 从竞彩赛程获取所有在售比赛（未来7天）
async function fetchAllSellingMatches() {
  const j = await httpGetJson(resolveUrl(SPORTTERY_LIST_URL), 20000);
  const groups = j && j.value && j.value.matchInfoList;
  if (!groups || !groups.length) {
    console.log('[sync] 竞彩接口无返回，或已被限速');
    return [];
  }
  const matches = [];
  for (const g of groups) {
    const subs = g.subMatchList || [];
    for (const m of subs) {
      // 只取在售比赛（Selling），跳过已结算
      if (m.matchStatus && m.matchStatus !== 'Selling') continue;
      matches.push({
        matchNum:    m.matchNum,          // 如 3001
        matchNumStr: m.matchNumStr || '',  // 如 "周三001"
        matchDate:   m.matchDate || m.businessDate || '',
        matchTime:   m.matchTime || '',
        leagueAbb:   m.leagueAbbName || m.leagueAllName || '',
        leagueFull:  m.leagueAllName || m.leagueAbbName || '',
        homeTeam:    m.homeTeamAllName || m.homeTeamAbbName || '',
        awayTeam:    m.awayTeamAllName || m.awayTeamAbbName || '',
        matchStatus: m.matchStatus || 'Selling',
        // odds
        oddsList:    m.oddsList || [],
      });
    }
  }
  return matches;
}

// 从数据库查询已有记录（今日起前后7天），返回 matchNum → {id, handicap, odds, odds_type}
async function getExistingMatchNums(db, daysBack = 7, daysForward = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const future = new Date();
  future.setDate(future.getDate() + daysForward);
  const sql = `SELECT id, weekday, match_no, handicap, odds, odds_type FROM sweep_records WHERE match_time >= ? AND match_time <= ?`;
  const today = cutoff.toISOString().slice(0, 10);
  const endDay = future.toISOString().slice(0, 10);
  const map = new Map();
  try {
    if (db.type === 'turso') {
      const r = await db.client.execute({
        sql,
        args: [today + ' 00:00:00', endDay + ' 23:59:59'],
      });
      for (const row of (r.rows || [])) {
        const wd = row.weekday, mn = row.match_no;
        if (wd && mn) {
          const key = String(Number(wd) * 1000 + parseInt(mn, 10));
          map.set(key, { id: row.id, handicap: row.handicap, odds: row.odds, odds_type: row.odds_type });
        }
      }
      return map;
    }
    const rows = db.exec(sql, [today + ' 00:00:00', endDay + ' 23:59:59']);
    if (!rows.length || !rows[0].values.length) return map;
    for (const row of rows[0].values) {
      const [id, wd, mn, handicap, odds, odds_type] = row;
      if (wd && mn) {
        const key = String(wd * 1000 + parseInt(mn));
        map.set(key, { id, handicap, odds, odds_type });
      }
    }
    return map;
  } catch(e) {
    console.error('[sync] 查询已有记录失败:', e.message);
    return map;
  }
}

// 提取玩法的 handicap JSON
function extractHandicap(oddsList) {
  const plays = [];
  if (!oddsList || !oddsList.length) return '[]';

  // HHAD = 让球胜平负
  const had = oddsList.find(o => o.poolCode === 'HHAD');
  if (had && had.h != null) {
    plays.push({ pick: '让胜', handicap: String(had.goalLine), result: 'pending' });
    plays.push({ pick: '让平', handicap: String(had.goalLine), result: 'pending' });
    plays.push({ pick: '让负', handicap: String(had.goalLine), result: 'pending' });
  }

  // HAD = 胜平负
  const had2 = oddsList.find(o => o.poolCode === 'HAD');
  if (had2) {
    if (had2.h != null) plays.push({ pick: '胜', result: 'pending' });
    if (had2.d != null) plays.push({ pick: '平', result: 'pending' });
    if (had2.a != null) plays.push({ pick: '负', result: 'pending' });
  }

  // CRS = 比分
  const crs = oddsList.find(o => o.poolCode === 'CRS');
  if (crs) {
    const scoreOpts = ['1:0','2:0','2:1','3:0','3:1','3:2','4:0','4:1','4:2','5:0','5:1','5:2','胜其它','0:0','1:1','2:2','3:3','平其它','0:1','0:2','1:2','0:3','1:3','2:3','0:4','1:4','2:4','0:5','1:5','2:5','负其它'];
    scoreOpts.forEach(pick => plays.push({ pick, result: 'pending' }));
  }

  // TGM = 总进球
  const tgm = oddsList.find(o => o.poolCode === 'TGM');
  if (tgm) {
    const goalOpts = ['0','1','2','3','4','5','6','7+'];
    goalOpts.forEach(pick => plays.push({ pick, result: 'pending' }));
  }

  // HAFU = 半全场
  const hafu = oddsList.find(o => o.poolCode === 'HAFU');
  if (hafu) {
    const hfOpts = ['胜胜','胜平','胜负','平胜','平平','平负','负胜','负平','负负'];
    hfOpts.forEach(pick => plays.push({ pick, result: 'pending' }));
  }

  return JSON.stringify(plays.slice(0, 50));
}

// 解析 matchNum → weekday + matchNo
function parseMatchNum(matchNum) {
  const n = Number(matchNum);
  if (isNaN(n) || n < 1000) return { weekday: null, matchNo: null };
  const wd = Math.floor(n / 1000);
  const mn = String(n % 1000).padStart(3, '0');
  return { weekday: (wd >= 1 && wd <= 7) ? wd : null, matchNo: mn };
}

// 组合完整比赛时间
function buildMatchTime(matchDate, matchTime) {
  // matchDate: "2026-09-20", matchTime: "18:00"
  if (!matchDate) return new Date().toISOString();
  if (matchTime && matchTime.match(/^\d{2}:\d{2}$/)) {
    return matchDate + 'T' + matchTime + ':00.000Z';
  }
  return matchDate + 'T12:00:00.000Z';
}

// 生成 UUID
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// 主同步函数（供 cron/手动调用）
async function runSync(opts) {
  opts = opts || {};
  const dryRun = process.argv.includes('--dry-run') || opts.dryRun;
  console.log('[sync] ===== 竞彩赛程自动同步 =====');
  console.log('[sync] 模式:', dryRun ? 'DRY-RUN（不写入）' : '写入模式');
  console.log('[sync] 开始时间:', new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));

  // 连接 DB（sql.js 异步）
  let SQL;
  try {
    const initSqlJs = require('sql.js');
    SQL = await initSqlJs();
  } catch(e) {
    console.error('[sync] sql.js 加载失败:', e.message);
    return { success: false, error: e.message };
  }

  let db;
  if (process.env.TURSO_DATABASE_URL) {
    // Turso 远端
    const { createClient } = require('@libsql/client');
    const turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    db = { type: 'turso', client: turso };
  } else {
    // 本地文件
    let buf = null;
    if (fs.existsSync(DB_PATH)) buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
    db.type = 'local';
  }

  // 查询已有编号
  const existingMap = await getExistingMatchNums(db);
  console.log('[sync] 数据库已有记录:', existingMap.size, '条');

  // 拉取竞彩赛程
  console.log('[sync] 正在拉取竞彩官网赛程...');
  const matches = await fetchAllSellingMatches();
  console.log('[sync] 竞彩官网在售比赛:', matches.length, '场');

  if (!matches.length) {
    return { success: false, error: '竞彩官网无返回数据，可能已被限速或非销售时间' };
  }

  // 统计：新增 vs 有变化 vs 无变化
  const newMatches = [];
  const updatedMatches = [];
  for (const m of matches) {
    if (!m.matchNum) continue;
    const key = String(m.matchNum);
    const exist = existingMap.get(key);
    if (!exist) newMatches.push(m);
    else {
      const newHandicap = extractHandicap(m.oddsList);
      if ((exist.handicap || '') !== newHandicap) {
        updatedMatches.push({ match: m, exist, newHandicap });
      }
    }
  }
  console.log('[sync] 新增:', newMatches.length, '场 | 赔率有变:', updatedMatches.length, '场');

  if (!newMatches.length && !updatedMatches.length) {
    console.log('[sync] ✅ 没有变化，结束');
    return { success: true, imported: 0, updated: 0, skipped: matches.length, message: '无变化' };
  }

  // 写入数据库
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  // 写入新记录
  for (const m of newMatches) {
    const { weekday, matchNo } = parseMatchNum(m.matchNum);
    if (!weekday) { skipped++; continue; }

    const id = uuid();
    const mid = 'sweep-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const handicap = extractHandicap(m.oddsList);
    const matchTime = buildMatchTime(m.matchDate, m.matchTime);
    const league = m.leagueFull || m.leagueAbb || '';
    const status = 'pending';
    const result = 'pending';
    const category = '人工扫盘';
    const data_source = 'auto_sync';
    const uploaded_by = 'system-auto';

    const vals = [
      id, mid, league, m.homeTeam, m.awayTeam, matchTime,
      handicap, null, null, null, 'free', result, status,
      uploaded_by, weekday, matchNo, null, new Date().toISOString(),
      category, null, data_source,
    ];

    if (dryRun) {
      console.log('[DRY-NEW]', league, m.homeTeam, 'vs', m.awayTeam, '|', m.matchNumStr);
      imported++;
      continue;
    }

    if (db.type === 'turso') {
      try {
        await db.client.execute({
          sql: `INSERT INTO sweep_records (id,match_id,league,home_team,away_team,match_time,handicap,odds,odds_type,confidence_stars,tier_required,result,status,uploaded_by,weekday,match_no,published_at,updated_at,category,detail_url,data_source)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: vals,
        });
        imported++;
      } catch(e) {
        console.error('[sync] 写入失败:', m.homeTeam, 'vs', m.awayTeam, e.message);
        skipped++;
      }
    } else {
      const cols = 'id,match_id,league,home_team,away_team,match_time,handicap,odds,odds_type,confidence_stars,tier_required,result,status,uploaded_by,weekday,match_no,published_at,updated_at,category,detail_url,data_source';
      const qs = Array(vals.length).fill('?').join(',');
      try {
        db.run(`INSERT INTO sweep_records (${cols}) VALUES (${qs})`, vals);
        imported++;
      } catch(e) {
        console.error('[sync] 写入失败:', m.homeTeam, 'vs', m.awayTeam, e.message);
        skipped++;
      }
    }
  }

  // 检测到赔率变化的记录：先写历史，再更新当前
  for (const u of updatedMatches) {
    const m = u.match;
    const exist = u.exist;
    if (dryRun) {
      console.log('[DRY-UPD]', m.leagueFull || m.leagueAbb, m.homeTeam, 'vs', m.awayTeam, '|', m.matchNumStr);
      updated++;
      continue;
    }
    try {
      // 写历史（保留旧值）
      const histId = uuid();
      if (db.type === 'turso') {
        await db.client.execute({
          sql: `INSERT INTO sweep_odds_history (id, sweep_id, handicap, odds, odds_type, source) VALUES (?,?,?,?,?,?)`,
          args: [histId, exist.id, exist.handicap || null, exist.odds, exist.odds_type || null, 'sync'],
        });
        // 更新当前
        await db.client.execute({
          sql: `UPDATE sweep_records SET handicap = ?, updated_at = datetime('now') WHERE id = ?`,
          args: [u.newHandicap, exist.id],
        });
      } else {
        db.run(`INSERT INTO sweep_odds_history (id, sweep_id, handicap, odds, odds_type, source) VALUES (?,?,?,?,?,?)`,
          [histId, exist.id, exist.handicap || null, exist.odds, exist.odds_type || null, 'sync']);
        db.run(`UPDATE sweep_records SET handicap = ?, updated_at = datetime('now') WHERE id = ?`, [u.newHandicap, exist.id]);
      }
      updated++;
    } catch(e) {
      console.error('[sync] 更新失败:', m.homeTeam, 'vs', m.awayTeam, e.message);
      skipped++;
    }
  }

  console.log('[sync] ===== 同步完成 =====');
  console.log('[sync] 新增写入:', imported, '条');
  console.log('[sync] 赔率更新:', updated, '条');
  console.log('[sync] 跳过/失败:', skipped, '条');
  console.log('[sync] 竞彩总数:', matches.length, '场');

  return { success: true, imported, updated, skipped, total: matches.length };
}

// 直接运行
if (require.main === module) {
  runSync().then(r => {
    console.log('[sync] 结果:', JSON.stringify(r));
    process.exit(0);
  }).catch(e => {
    console.error('[sync] 异常:', e.message);
    process.exit(1);
  });
}

module.exports = { runSync };
