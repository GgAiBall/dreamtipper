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

// 本地运行时自动加载 server/.env（存在才加载；不覆盖已有环境变量）
(function loadEnv() {
  try {
    const p = path.join(__dirname, '.env');
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach(function (line) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) { /* ignore */ }
})();

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

// 归一化 key（去除空白）
function normKey(s) { return String(s == null ? '' : s).replace(/\s+/g, '').trim(); }
// 队名归一：去空白 + 去掉音译衬字「尔」（兼容 埃沃斯堡/埃尔沃斯堡）
function teamKey(s) { return normKey(s).replace(/尔/g, ''); }

// 从数据库查询已有记录（近7天~未来14天）
// 返回 Map：key = weekday|match_no|home_team|away_team → {id, handicap, odds, odds_type, status}
async function getExistingMatchNums(db, daysBack = 7, daysForward = 14) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  const future = new Date();
  future.setDate(future.getDate() + daysForward);
  const sql = `SELECT id, weekday, match_no, home_team, away_team, handicap, odds, odds_type, status, data_source FROM sweep_records WHERE match_time >= ? AND match_time <= ?`;
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
        if (row.weekday && row.match_no) {
          const key = normKey(row.weekday) + '|' + teamKey(row.home_team) + '|' + teamKey(row.away_team);
          map.set(key, { id: row.id, handicap: row.handicap, odds: row.odds, odds_type: row.odds_type, status: row.status, data_source: row.data_source });
        }
      }
      return map;
    }
    const rows = db.exec(sql, [today + ' 00:00:00', endDay + ' 23:59:59']);
    if (!rows.length || !rows[0].values.length) return map;
    for (const row of rows[0].values) {
      const [id, wd, mn, home, away, handicap, odds, odds_type, status, data_source] = row;
      if (wd && mn) {
        const key = normKey(wd) + '|' + teamKey(home) + '|' + teamKey(away);
        map.set(key, { id, handicap, odds, odds_type, status, data_source });
      }
    }
    return map;
  } catch(e) {
    console.error('[sync] 查询已有记录失败:', e.message);
    return map;
  }
}

// 提取玩法的 handicap JSON
// 把 "1:0=7.50,2:0=8.00" 解析为 { "1:0": 7.5, "2:0": 8 }
function parseOddsString(str) {
  const out = {};
  if (!str || typeof str !== 'string') return out;
  str.split(',').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = parseFloat(part.slice(idx + 1));
      if (k && !isNaN(v)) out[k] = v;
    }
  });
  return out;
}
function numOrStr(v) { const n = parseFloat(v); return isNaN(n) ? v : n; }

function extractHandicap(oddsList) {
  const plays = [];
  if (!Array.isArray(oddsList) || !oddsList.length) return '[]';
  const byCode = {};
  for (const o of oddsList) if (o.poolCode) byCode[o.poolCode] = o;

  // HAD = 胜平负（带真实赔率）
  const had = byCode.HAD;
  if (had && had.h) {
    plays.push({ key: 'win_draw_loss', pick: '胜/平/负', odds: { '胜': numOrStr(had.h), '平': numOrStr(had.d), '负': numOrStr(had.a) }, result: 'pending' });
  }

  // HHAD = 让球胜平负（带盘口 + 真实赔率）
  const hhad = byCode.HHAD;
  if (hhad && hhad.h) {
    const line = String(hhad.goalLine || '');
    plays.push({ key: 'handicap', line, pick: '让胜/让平/让负', odds: { '让胜': numOrStr(hhad.h), '让平': numOrStr(hhad.d), '让负': numOrStr(hhad.a) }, result: 'pending' });
  }

  // CRS = 比分（赔率串）
  const crs = byCode.CRS;
  if (crs && crs.odds) {
    const m = parseOddsString(crs.odds);
    if (Object.keys(m).length) plays.push({ key: 'score', pick: Object.keys(m).join('/'), odds: m, result: 'pending' });
  }

  // TGM = 总进球（赔率串）
  const tgm = byCode.TGM;
  if (tgm && tgm.odds) {
    const m = parseOddsString(tgm.odds);
    if (Object.keys(m).length) plays.push({ key: 'goals', pick: Object.keys(m).join('/'), odds: m, result: 'pending' });
  }

  // HAFU = 半全场（赔率串）
  const hafu = byCode.HAFU;
  if (hafu && hafu.odds) {
    const m = parseOddsString(hafu.odds);
    if (Object.keys(m).length) plays.push({ key: 'half_full', pick: Object.keys(m).join('/'), odds: m, result: 'pending' });
  }

  return JSON.stringify(plays);
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
    // 存北京时间的本地墙钟时间（不加 Z，避免时区偏移 8 小时）
    return matchDate + 'T' + matchTime + ':00';
  }
  return matchDate + 'T12:00:00';
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
  const fillMatches = [];   // 已发布记录：仅补空字段
  for (const m of matches) {
    if (!m.matchNum) continue;
    const pm = parseMatchNum(m.matchNum);
    if (!pm.weekday) continue;
    const key = normKey(pm.weekday) + '|' + teamKey(m.homeTeam) + '|' + teamKey(m.awayTeam);
    const exist = existingMap.get(key);
    if (!exist) { newMatches.push(m); continue; }
    const newHandicap = extractHandicap(m.oddsList);
    const emptyHandicap = !exist.handicap || exist.handicap === '' || exist.handicap === '[]' || exist.handicap === 'null';
    if (exist.status === 'published' || exist.data_source === 'admin_upload') {
      // 以「我发布的/我上传的」为主：只补空字段，不改已有内容
      if (emptyHandicap && newHandicap !== '[]') fillMatches.push({ match: m, exist, newHandicap });
    } else if ((exist.handicap || '') !== newHandicap) {
      updatedMatches.push({ match: m, exist, newHandicap });
    }
  }
  console.log('[sync] 新增:', newMatches.length, '场 | 赔率有变:', updatedMatches.length, '场 | 已发布仅补空:', fillMatches.length, '场');

  if (!newMatches.length && !updatedMatches.length && !fillMatches.length) {
    console.log('[sync] ✅ 没有变化，结束');
    return { success: true, imported: 0, updated: 0, filled: 0, skipped: matches.length, message: '无变化' };
  }

  // 写入数据库
  let imported = 0;
  let updated = 0;
  let filled = 0;
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
      null,                              // sporttery_match_id
      m.matchId || null,                // wbsj_match_id
      m.homeTeamId || null,             // home_team_id
      m.awayTeamId || null,             // away_team_id
      m.leagueId || null,               // league_id
      m.tournamentId || null,           // tournament_id
      m.seasonId || null,               // season_id
    ];

    if (dryRun) {
      console.log('[DRY-NEW]', league, m.homeTeam, 'vs', m.awayTeam, '|', m.matchNumStr);
      imported++;
      continue;
    }

    if (db.type === 'turso') {
      try {
        await db.client.execute({
          sql: `INSERT INTO sweep_records (id,match_id,league,home_team,away_team,match_time,handicap,odds,odds_type,confidence_stars,tier_required,result,status,uploaded_by,weekday,match_no,published_at,updated_at,category,detail_url,data_source,sporttery_match_id,wbsj_match_id,home_team_id,away_team_id,league_id,tournament_id,season_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: vals,
        });
        imported++;
      } catch(e) {
        console.error('[sync] 写入失败:', m.homeTeam, 'vs', m.awayTeam, e.message);
        skipped++;
      }
    } else {
      const cols = 'id,match_id,league,home_team,away_team,match_time,handicap,odds,odds_type,confidence_stars,tier_required,result,status,uploaded_by,weekday,match_no,published_at,updated_at,category,detail_url,data_source,sporttery_match_id,wbsj_match_id,home_team_id,away_team_id,league_id,tournament_id,season_id';
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

  // 已发布记录：仅补空字段（不改已有内容）
  for (const f of fillMatches) {
    const m = f.match;
    if (dryRun) {
      console.log('[DRY-FILL]', m.leagueFull || m.leagueAbb, m.homeTeam, 'vs', m.awayTeam, '|', m.matchNumStr);
      filled++;
      continue;
    }
    try {
      if (db.type === 'turso') {
        await db.client.execute({ sql: `UPDATE sweep_records SET handicap = ?, updated_at = datetime('now') WHERE id = ?`, args: [f.newHandicap, f.exist.id] });
      } else {
        db.run(`UPDATE sweep_records SET handicap = ?, updated_at = datetime('now') WHERE id = ?`, [f.newHandicap, f.exist.id]);
      }
      filled++;
    } catch(e) {
      console.error('[sync] 补空失败:', m.homeTeam, 'vs', m.awayTeam, e.message);
      skipped++;
    }
  }

  console.log('[sync] ===== 同步完成 =====');
  console.log('[sync] 新增写入:', imported, '条');
  console.log('[sync] 赔率更新:', updated, '条');
  console.log('[sync] 已发布补空:', filled, '条');
  console.log('[sync] 跳过/失败:', skipped, '条');
  console.log('[sync] 竞彩总数:', matches.length, '场');

  return { success: true, imported, updated, filled, skipped, total: matches.length };
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
