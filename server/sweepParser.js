// sweepParser.js — 扫盘表格解析与字段自动识别
// 支持 xlsx / xls / csv / json，自动识别中英文表头别名
const XLSX = require('xlsx');

// 字段 -> 表头别名（已归一化：小写、去空格/下划线/连字符/括号）
const FIELD_ALIASES = {
  league: ['league', '联赛', '联赛名', 'competition', '赛事'],
  home_team: ['hometeam', '主队', '主队名', '主场', 'home'],
  away_team: ['awayteam', '客队', '客队名', '客场', 'away'],
  match_time: ['matchtime', '比赛时间', '开赛时间', '时间', 'time', 'datetime', 'date', 'kickoff'],
  weekday: ['weekday', '周几', '星期', '星期几', 'day'],
  match_no: ['matchno', '场次', '场次编号', '编号', 'no', 'num'],
  confidence_stars: ['confidencestars', 'confidence', '信心', '信心星级', '星级', 'stars'],
  tier_required: ['tierrequired', 'tier', '权限', '会员等级', 'vip'],
  result: ['result', '结果', '赛果', 'outcome'],
  odds: ['odds', '赔率'],
  win_draw_loss: ['windrawloss', '胜平负', '胜平负推荐', '主胜平负', 'wdl'],
  handicap: ['handicap', '让球', '让球盘', '让分', '让球推荐', '亚洲盘'],
  score: ['score', '比分', '比分推荐', '精准比分', 'correctscore'],
  goals: ['goals', '进球', '总进球', '大小球', '进球数', 'totalgoals', 'overunder'],
  half_full: ['halffull', '半全场', '半全', '半场全场', 'htft'],
  category: ['category', '分类', '类型', '来源', '数据来源'],
  detail_url: ['detailurl', '详情', '详情页', '详情链接', '链接', 'link', 'url', 'h5', 'h5链接'],
};

const PLAY_KEYS = ['win_draw_loss', 'handicap', 'score', 'goals', 'half_full'];

function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/[\s_（）()\-]/g, '');
}

function buildHeaderMap(headers) {
  const map = {};
  const used = [];
  for (const h of headers) {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.map(norm).includes(n)) { map[field] = h; used.push(h); break; }
    }
  }
  return { map, used };
}

const WEEKDAY_TABLE = {
  1: ['1', '一', '周一', '星期一', 'mon', 'monday'],
  2: ['2', '二', '周二', '星期二', 'tue', 'tues', 'tuesday'],
  3: ['3', '三', '周三', '星期三', 'wed', 'wednesday'],
  4: ['4', '四', '周四', '星期四', 'thu', 'thur', 'thursday'],
  5: ['5', '五', '周五', '星期五', 'fri', 'friday'],
  6: ['6', '六', '周六', '星期六', 'sat', 'saturday'],
  7: ['7', '日', '周日', '星期天', '星期日', 'sun', 'sunday'],
};
function parseWeekday(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (/^[1-7]$/.test(s)) return parseInt(s);
  for (const [num, keys] of Object.entries(WEEKDAY_TABLE)) {
    if (keys.some(k => s.includes(k))) return parseInt(num);
  }
  return null;
}

const TIER_TABLE = {
  free: ['free', '免费', '🆓', '公开', '普通', 'f'],
  monthly: ['monthly', '月度', '月', '💎', 'm', '会员', '付费'],
  yearly: ['yearly', '年度', '年', '👑', 'y', '尊享', '至尊'],
};
function normalizeTier(v) {
  if (!v) return 'free';
  const s = String(v).trim().toLowerCase();
  for (const [tier, keys] of Object.entries(TIER_TABLE)) {
    if (keys.some(k => s.includes(k))) return tier;
  }
  return 'free';
}

const RESULT_TABLE = {
  win: ['win', '红', '胜', '对', '中', 'w'],
  loss: ['loss', '黑', '负', '错', 'l'],
  push: ['push', '走', '平', '退', 'p'],
};
function normalizeResult(v) {
  if (!v) return 'pending';
  const s = String(v).trim().toLowerCase();
  for (const [r, keys] of Object.entries(RESULT_TABLE)) {
    if (keys.some(k => s.includes(k))) return r;
  }
  return 'pending';
}

function pad(n) { return String(n).padStart(2, '0'); }
function fmtUTC(d) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function normalizeTime(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date) return fmtUTC(v);
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return fmtUTC(d);
  }
  let s = String(v).trim().replace(/\//g, '-');
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{1,2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${pad(m[5])}`;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return s.replace(' ', 'T').slice(0, 16);
  return s.slice(0, 16);
}
function deriveWeekday(matchTime) {
  if (!matchTime) return null;
  const d = new Date(matchTime);
  if (isNaN(d.getTime())) return null;
  return d.getDay() === 0 ? 7 : d.getDay();
}
function clampInt(v, min, max, def) {
  const n = parseInt(v);
  if (isNaN(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function parseRows(rows) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const { map, used } = buildHeaderMap(headers);
  const records = [];
  const errors = [];
  const get = (row, f) => (map[f] != null ? row[map[f]] : undefined);

  rows.forEach((row, i) => {
    const line = i + 2; // 含表头，Excel 行号从 2 开始
    const league = String(get(row, 'league') || '').trim();
    const home = String(get(row, 'home_team') || '').trim();
    const away = String(get(row, 'away_team') || '').trim();
    if (!league || !home || !away) {
      errors.push(`第 ${line} 行：缺少「联赛/主队/客队」，已跳过`);
      return;
    }
    const matchTime = normalizeTime(get(row, 'match_time'));
    const plays = {};
    for (const pk of PLAY_KEYS) {
      const v = String(get(row, pk) || '').trim();
      if (v) plays[pk] = { pick: v, result: 'pending' };
    }
    if (Object.keys(plays).length === 0) plays.win_draw_loss = { pick: '', result: 'pending' };
    const result = normalizeResult(get(row, 'result'));
    if (result !== 'pending') {
      for (const pk of Object.keys(plays)) plays[pk].result = result;
    }
    let weekday = parseWeekday(get(row, 'weekday'));
    if (!weekday) weekday = deriveWeekday(matchTime);

    records.push({
      league,
      home_team: home,
      away_team: away,
      match_time: matchTime || null,
      handicap: JSON.stringify(plays),
      odds: parseFloat(get(row, 'odds')) || 0,
      odds_type: 'multi',
      confidence_stars: clampInt(get(row, 'confidence_stars'), 1, 5, 3),
      tier_required: normalizeTier(get(row, 'tier_required')),
      weekday: weekday || 0,
      match_no: String(get(row, 'match_no') || '').trim(),
      category: String(get(row, 'category') || '').trim() || '人工扫盘',
      detail_url: String(get(row, 'detail_url') || '').trim() || null,
      result,
      status: 'pending',
    });
  });

  return { records, errors, usedHeaders: used };
}

// 从 multer 内存文件（buffer）解析为记录数组
function parseFile(buffer, originalName) {
  const ext = (originalName || '').split('.').pop().toLowerCase();
  const XLSX = require('xlsx');
  if (ext === 'json') {
    const raw = JSON.parse(buffer.toString('utf-8'));
    const rows = Array.isArray(raw) ? raw : (raw.records || []);
    return parseRows(rows);
  }
  if (ext === 'csv') {
    const wb = XLSX.read(buffer, { type: 'buffer', cellText: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
    return parseRows(rows);
  }
  // xlsx / xls
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, cellDates: true });
  return parseRows(rows);
}

module.exports = { parseFile, parseRows, FIELD_ALIASES, PLAY_KEYS };
