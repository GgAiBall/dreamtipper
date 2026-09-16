// server/resultSource.js
// 依据「周几 + 场次编号」(例如 周一001) 自动获取竞彩官网比赛结果，并据此判定红/黑单。
// 数据源通过环境变量 OFFICIAL_RESULT_API 配置（返回可被归一化的 JSON）。
// 未配置数据源时 fetchOfficialResult 返回 null，由前端提示“未配置数据源”。

const https = require('https');
const http = require('http');

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return getJSON(new URL(res.headers.location, url).toString()).then(resolve, reject);
      }
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('结果解析失败')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('请求超时')));
  });
}

// 把任意来源的官方结果归一化为标准结构 { home_score, away_score, half_home, half_away }
function normalizeOfficial(raw) {
  if (!raw) return null;
  const get = (...keys) => {
    for (const k of keys) { if (raw[k] != null && raw[k] !== '') return raw[k]; }
    return undefined;
  };
  const home = get('home_score', 'homeScore', 'score_home', 'hs', 'home');
  const away = get('away_score', 'awayScore', 'score_away', 'as', 'away');
  if (home == null || away == null) return null;
  return {
    home_score: parseInt(home),
    away_score: parseInt(away),
    half_home: get('half_home', 'halfHome') != null ? parseInt(get('half_home', 'halfHome')) : null,
    half_away: get('half_away', 'halfAway') != null ? parseInt(get('half_away', 'halfAway')) : null,
  };
}

const WDL = {
  '主胜': 'win', '胜': 'win', '3': 'win', 'w': 'win', '赢': 'win',
  '平': 'draw', '1': 'draw', 'd': 'draw',
  '客胜': 'loss', '负': 'loss', '0': 'loss', 'l': 'loss',
};

function wdlOf(home, away) {
  if (home > away) return 'win';
  if (home < away) return 'loss';
  return 'draw';
}

// 解析玩法推荐字符串 -> 结构化对象
function parsePick(key, pick) {
  const p = String(pick || '').trim();
  if (!p) return null;
  if (key === 'win_draw_loss') {
    const v = WDL[p] || (p.includes('胜') ? 'win' : p.includes('平') ? 'draw' : p.includes('负') || p.includes('客胜') ? 'loss' : null);
    return { type: 'wdl', value: v };
  }
  if (key === 'score') {
    const m = p.match(/(\d+)\s*[:：\-]\s*(\d+)/);
    if (m) return { type: 'score', h: parseInt(m[1]), a: parseInt(m[2]) };
    return null;
  }
  if (key === 'goals') {
    let m = p.match(/([大小])\s*?(\d+(?:\.\d+)?)/);
    if (m) return { type: 'goals', dir: m[1] === '大' ? 'over' : 'under', line: parseFloat(m[2]) };
    m = p.match(/^(\d+(?:\.\d+)?)\s*[球]/);
    if (m) return { type: 'goals', exact: parseFloat(m[1]) };
    m = p.match(/^(\d+(?:\.\d+)?)$/);
    if (m) return { type: 'goals', exact: parseFloat(m[1]) };
    return null;
  }
  if (key === 'handicap') {
    let m = p.match(/(主|客|主队|客队)\s*(?:让)?\s*([+\-]?\d+(?:\.\d+)?)\s*(胜|平|负|赢|输)?/);
    let side, line, res;
    if (m) {
      side = (m[1] === '客' || m[1] === '客队') ? 'away' : 'home';
      line = parseFloat(m[2]);
      res = m[3] ? (WDL[m[3]] || (m[3].includes('胜') || m[3].includes('赢') ? 'win' : m[3].includes('平') ? 'draw' : 'loss')) : null;
    } else {
      m = p.match(/([+\-]?\d+(?:\.\d+)?)\s*(胜|平|负|赢|输)?/);
      if (!m) return null;
      side = parseFloat(m[1]) >= 0 ? 'home' : 'away';
      line = parseFloat(m[1]);
      res = m[2] ? (WDL[m[2]] || (m[2].includes('胜') || m[2].includes('赢') ? 'win' : m[2].includes('平') ? 'draw' : 'loss')) : null;
    }
    return { type: 'handicap', side, line, result: res };
  }
  if (key === 'half_full') {
    const parts = p.split(/[\/／]/).map(s =>
      WDL[s.trim()] || (s.includes('胜') ? 'win' : s.includes('平') ? 'draw' : s.includes('负') ? 'loss' : null));
    if (parts.length === 2) return { type: 'half_full', half: parts[0], full: parts[1] };
    return null;
  }
  return null;
}

function computePlay(key, pick, official) {
  const parsed = parsePick(key, pick);
  if (!parsed) return 'pending';
  if (parsed.type === 'wdl') {
    if (!parsed.value) return 'pending';
    return parsed.value === wdlOf(official.home_score, official.away_score) ? 'win' : 'loss';
  }
  if (parsed.type === 'score') {
    return (parsed.h === official.home_score && parsed.a === official.away_score) ? 'win' : 'loss';
  }
  if (parsed.type === 'goals') {
    const total = official.home_score + official.away_score;
    if (parsed.exact != null) return parsed.exact === total ? 'win' : 'loss';
    if (parsed.dir === 'over') return total > parsed.line ? 'win' : (total === parsed.line ? 'push' : 'loss');
    if (parsed.dir === 'under') return total < parsed.line ? 'win' : (total === parsed.line ? 'push' : 'loss');
  }
  if (parsed.type === 'handicap') {
    const adjHome = parsed.side === 'home' ? official.home_score - parsed.line : official.home_score + parsed.line;
    const adjAway = parsed.side === 'home' ? official.away_score + parsed.line : official.away_score - parsed.line;
    const actual = wdlOf(adjHome, adjAway);
    return parsed.result ? (parsed.result === actual ? 'win' : 'loss') : (actual === 'win' ? 'win' : 'pending');
  }
  if (parsed.type === 'half_full') {
    if (official.half_home == null) return 'pending';
    const halfActual = wdlOf(official.half_home, official.half_away);
    const fullActual = wdlOf(official.home_score, official.away_score);
    const ok = (parsed.half == null || parsed.half === halfActual) && (parsed.full == null || parsed.full === fullActual);
    return ok ? 'win' : 'loss';
  }
  return 'pending';
}

// 给定玩法 JSON 与官方结果，逐玩法判定红/黑，并汇总整单结果
function computeSweepResult(plays, officialRaw) {
  const official = normalizeOfficial(officialRaw);
  if (!official) return { plays, sweepResult: 'pending' };
  const out = {};
  const results = [];
  for (const [k, v] of Object.entries(plays || {})) {
    const r = computePlay(k, v && v.pick, official);
    out[k] = { pick: v && v.pick, result: r };
    if (r !== 'pending') results.push(r);
  }
  let sweepResult = 'pending';
  if (results.length > 0) {
    if (results.every(x => x === 'win')) sweepResult = 'win';
    else if (results.some(x => x === 'loss')) sweepResult = 'loss';
    else if (results.every(x => x === 'push')) sweepResult = 'push';
  }
  return { plays: out, sweepResult, official };
}

// 依据编号(周几+场次)获取官网结果；OFFICIAL_RESULT_API 支持 {weekday}{matchNo}{date}{league}{home}{away} 占位
async function fetchOfficialResult(query) {
  const api = process.env.OFFICIAL_RESULT_API;
  if (!api) return null;
  try {
    const url = api
      .replace('{weekday}', query.weekday ?? '')
      .replace('{matchNo}', query.matchNo ?? '')
      .replace('{date}', query.date ?? '')
      .replace('{league}', encodeURIComponent(query.league || ''))
      .replace('{home}', encodeURIComponent(query.home || ''))
      .replace('{away}', encodeURIComponent(query.away || ''));
    const raw = await getJSON(url);
    return normalizeOfficial(raw) ? raw : null;
  } catch (e) { return null; }
}

module.exports = { fetchOfficialResult, computeSweepResult, normalizeOfficial };
