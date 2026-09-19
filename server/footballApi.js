/**
 * 足球数据 API 服务模块（双源：API-Football + football-data.org）
 * - API-Football: 历史赛季数据（积分/场均/近况/交锋），免费100次/天
 * - football-data.org: 当前赛季实时数据，免费100次/天
 */
const https = require('https');

// ─── API 配置 ───────────────────────────────────────────────────────────────
const APIF_KEY = process.env.FOOTBALL_API_KEY || '28bd489ab98dba2ed1b0f78827408ee5';
const APIF_BASE = 'https://v3.football.api-sports.io';
const FDB_KEY = process.env.FOOTBALL_DATA_KEY || '';   // football-data.org key（可选）
const FDB_BASE = 'https://api.football-data.org/v4';

// ─── football-data.org 联赛码（先定义）──────────────────────────────────────────
const FD_LEAGUES = { PL: 2021, PD: 2014, SA: 2019, BL1: 2002, FL1: 2015, CL: 2001, EL: 2130 };

// ─── 联赛 ID 映射（两个 API 共用）──────────────────────────────────────────────
const LEAGUE_IDS = {
  '英超': { af: 39,  fd: 'PL', name: 'Premier League' },
  '西甲': { af: 140, fd: 'PD', name: 'La Liga' },
  '意甲': { af: 135, fd: 'SA', name: 'Serie A' },
  '德甲': { af: 78,  fd: 'BL1', name: 'Bundesliga' },
  '法甲': { af: 61,  fd: 'FL1', name: 'Ligue 1' },
  '中超': { af: 169, fd: null, name: 'Chinese Super League' },
  'J联赛': { af: 98, fd: null, name: 'J1 League' },
  'K联赛': { af: 292, fd: null, name: 'K League 1' },
  '欧冠': { af: 2,   fd: 'CL', name: 'UEFA Champions League' },
  '欧罗巴': { af: 3, fd: 'EL', name: 'UEFA Europa League' },
  '欧联': { af: 3,  fd: null, name: 'UEFA Europa League' },
};

// ─── 球队别名映射（中文/缩写 → API-Football ID）─────────────────────────────────
const TEAM_ALIAS = {
  // 英超
  'arsenal': 42, '阿森纳': 42, '兵工厂': 42,
  'manchester united': 33, 'man u': 33, 'mu': 33, '曼联': 33, '红魔': 33,
  'liverpool': 40, '利物浦': 40, '红军': 40,
  'manchester city': 50, 'man city': 50, 'mc': 50, '曼城': 50, '蓝月亮': 50,
  'chelsea': 49, '切尔西': 49, '蓝军': 49,
  'tottenham': 47, 'spurs': 47, '热刺': 47, '托特纳姆': 47,
  'newcastle': 34, '纽卡斯尔': 34, '喜鹊': 34, '纽卡': 34,
  'brighton': 51, '布莱顿': 51,
  'aston villa': 464, 'villa': 464, '维拉': 464, '阿斯顿维拉': 464,
  'west ham': 48, '西汉姆': 48, '铁锤帮': 48,
  'everton': 45, '埃弗顿': 45, '太妃糖': 45,
  'leicester': 46, '莱斯特': 46, '蓝狐': 46,
  'brentford': 55, '布伦特福德': 55,
  'crystal palace': 52, '水晶宫': 52,
  'bournemouth': 35, '伯恩茅斯': 35,
  'fulham': 36, '富勒姆': 36,
  'wolves': 39, 'wolverhampton': 39, '狼队': 39,
  'nottingham forest': 65, 'forest': 65, '诺丁汉森林': 65, '森林': 65,
  'ipswich': 1039, '伊普斯维奇': 1039,
  'southampton': 41, '南安普顿': 41,
  'leeds': 63, 'leeds united': 63, '利兹': 63, '利兹联': 63,
  'burnley': 44, '伯恩利': 44,
  'luton': 62, '卢顿': 62,
  'sheffield': 62, 'sheffield united': 62, '谢菲联': 62, '谢菲尔德联': 62,
  // 西甲
  'real madrid': 541, '皇马': 541, '皇家马德里': 541,
  'barcelona': 529, '巴萨': 529, '巴塞罗那': 529,
  'atletico': 530, '马德里竞技': 530, '马竞': 530,
  'sevilla': 536, '塞维利亚': 536,
  'athletic': 536, '毕尔巴鄂': 536,
  'real sociedad': 548, '皇家社会': 548,
  'villarreal': 455, '比利亚雷亚尔': 455, '黄潜': 455,
  'betis': 543, '皇家贝蒂斯': 543, '贝蒂斯': 543,
  'valencia': 476, '瓦伦西亚': 476,
  'athletic bilbao': 536, '毕尔巴鄂竞技': 536,
  // 意甲
  'inter': 505, '国际米兰': 505, '国米': 505,
  'milan': 489, 'ac milan': 489, 'ac米兰': 489, '米兰': 489, 'AC米兰': 489,
  'juventus': 496, '尤文': 496, '尤文图斯': 496,
  'napoli': 492, '那不勒斯': 492,
  'roma': 487, '罗马': 487,
  'lazio': 487, '拉齐奥': 487,
  'atalanta': 500, '亚特兰大': 500,
  'fiorentina': 502, '佛罗伦萨': 502,
  // 德甲
  'bayern': 157, '拜仁': 157, '拜仁慕尼黑': 157,
  'dortmund': 165, '多特蒙德': 165, '大黄蜂': 165,
  'rb leipzig': 173, '莱比锡': 173, 'RB莱比锡': 173,
  'leverkusen': 168, '勒沃库森': 168,
  'frankfurt': 167, '法兰克福': 167,
  'wolfsburg': 161, '沃尔夫斯堡': 161,
  'gladbach': 161, '门兴': 161,
  // 法甲
  'psg': 85, '巴黎': 85, '巴黎圣日耳曼': 85,
  'marseille': 81, '马赛': 81,
  'monaco': 91, '摩纳哥': 91,
  'lyon': 80, '里昂': 80,
  'lille': 79, '里尔': 79,
  'nice': 108, '尼斯': 108,
  // 中超
  '上海海港': 3055, '上港': 3055, '海港': 3055,
  '北京国安': 3053, '国安': 3053,
  '山东泰山': 3064, '泰山': 3064,
  '上海绿地': 3056, '上海申花': 3056, '绿地': 3056,
  '广州': 3061, '广州队': 3061, '广州恒大': 3061,
  '武汉三镇': 11282, '三镇': 11282,
  '成都蓉城': 11284, '蓉城': 11284, '成都': 11284,
  '浙江': 3069, '浙江队': 3069,
  '河南嵩山': 3063, '河南': 3063,
  '天津津门虎': 3060, '天津': 3060, '津门虎': 3060,
  '深圳': 3065, '深圳队': 3065,
  '青岛海牛': 3059, '青岛': 3059,
  '南通支云': 11315, '南通': 11315,
  '沧州雄狮': 11316, '沧州': 11316,
  '梅州客家': 11293, '梅州': 11293,
  '长春亚泰': 11317, '长春': 11317,
  '青岛西海岸': 11318,
  // J联赛
  '横滨水手': 10471, '横滨': 10471,
  '川崎前锋': 10472, '川崎': 10472,
  '鹿岛鹿角': 10473, '鹿岛': 10473,
  '神户胜利': 10474, '神户': 10474,
  'FC东京': 10475, '东京': 10475,
  '大阪樱花': 10477, '大阪': 10477,
  '柏太阳神': 10476,
  '广岛三箭': 10478, '广岛': 10478,
  '札幌冈萨多': 10479, '札幌': 10479,
  '名古屋鲸': 10480, '名古屋': 10480,
  '清水心跳': 10481, '清水': 10481,
  '鸟栖沙岩': 10482, '鸟栖': 10482,
  '福冈黄蜂': 10483, '福冈': 10483,
  // K联赛
  '全北现代': 279, '全北': 279,
  '蔚山现代': 280, '蔚山': 280,
  '浦项制铁': 281, '浦项': 281,
  '水原三星': 282, '水原': 282,
  '首尔': 283, 'FC首尔': 283,
  '仁川联': 284, '仁川': 284,
  '大邱': 285, '大邱FC': 285,
  '济州联': 286, '济州': 286,
};

// ─── HTTP 工具函数 ────────────────────────────────────────────────────────────
function apiGetJson(baseUrl, path, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const opts = { hostname: url.hostname, port: url.port || 443, path: url.pathname + url.search, method: 'GET', headers };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ _raw: d.substring(0, 200) }); } });
    });
    req.on('error', reject);
    req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function afGet(path) {
  return apiGetJson(APIF_BASE, path, { 'x-apisports-key': APIF_KEY, 'Accept': 'application/json' });
}

function fdGet(path) {
  const h = { 'X-Auth-Token': FDB_KEY || '28bd489ab98dba2ed1b0f78827408ee5', 'Accept': 'application/json' };
  return apiGetJson(FDB_BASE, path, h);
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────
function getLeagues(name) {
  if (!name) return null;
  const l = name.toLowerCase().trim();
  for (const [key, val] of Object.entries(LEAGUE_IDS)) {
    if (l.includes(key) || key.includes(l)) return val;
  }
  return null;
}

// 球队名模糊匹配（简化版，query是否与text相关）
// 球队名模糊匹配（简化版）
// 0=false不匹配, 1=模糊匹配, 2=包含匹配
function teamMatch(query, text) {
  if (!query || !text) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q) || q.includes(t)) return 2;
  let idx = 0;
  for (const ch of q) {
    const pos = t.indexOf(ch, idx);
    if (pos === -1) {
      const eng = ch.toLowerCase().charCodeAt(0);
      if (eng >= 97 && eng <= 122) {
        const alt = t.indexOf(String.fromCharCode(eng), idx);
        if (alt === -1) return 0;
        idx = alt + 1;
      } else { return 0; }
    } else { idx = pos + 1; }
  }
  return 1;
}

function getAfLeagueId(name) {
  const lg = getLeagues(name);
  return lg ? lg.af : 39;
}

function getFdLeagueCode(name) {
  const lg = getLeagues(name);
  if (!lg || !lg.fd) return null;
  return FD_LEAGUES[lg.fd] || null;
}

// 模糊匹配：query 是否与 text 模糊匹配（包含/被包含/共同字符）
function fuzzyMatch(query, text) {
  if (!query || !text) return false;
  const q = query.toLowerCase().replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '');
  const t = text.toLowerCase().replace(/\s+/g, '').replace(/[^\u4e00-\u9fa5a-z0-9]/gi, '');
  if (t.includes(q) || q.includes(t)) return true;
  // 逐字匹配 query 中每个字符在 text 中顺序出现
  let idx = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, idx);
    if (found === -1) return false;
    idx = found + 1;
  }
  return true;
}

// 简化匹配：query 是否与 text 相关（包含/前缀/共同字符）
function teamMatch(query, text) {
  if (!query || !text) return false;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // 完全包含
  if (t.includes(q) || q.includes(t)) return 2;
  // 逐字符顺序匹配（容忍打字错误）
  let idx = 0;
  for (const ch of q) {
    const pos = t.indexOf(ch, idx);
    if (pos === -1) {
      // 英文字母容错（全小写比较）
      const eng = ch.toLowerCase().charCodeAt(0);
      if (eng >= 97 && eng <= 122) {
        const alt = t.indexOf(String.fromCharCode(eng), idx);
        if (alt === -1) return false;
        idx = alt + 1;
      } else {
        return false;
      }
    } else {
      idx = pos + 1;
    }
  }
  return 1; // 匹配但非完全包含
}

// ─── 球队搜索（双源模糊搜索）───────────────────────────────────────────────────
async function searchTeams(query, opts = {}) {
  const { league, season = 2024, limit = 20 } = opts;
  if (!query) return [];
  const results = [];
  const seen = new Set();

  // 1. 查别名表（精确/前缀匹配）
  const q = query.toLowerCase().trim();
  for (const [alias, id] of Object.entries(TEAM_ALIAS)) {
    const a = alias.toLowerCase();
    if (a === q || a.startsWith(q) || q.startsWith(a)) {
      if (seen.has(id)) continue;
      seen.add(id);
      try {
        // 用 search 参数做 API 级别的搜索
        const res = await afGet(`/teams?search=${encodeURIComponent(alias)}`);
        const t = res.response?.[0]?.team;
        if (t) results.push({ id: t.id, name: t.name, logo: t.logo, source: 'alias', leagueId: id });
      } catch(e) {}
      if (results.length >= limit) return results;
    }
  }

  // 2. API-Football search API（原生搜索）
  try {
    const res = await afGet(`/teams?search=${encodeURIComponent(query)}`);
    const teamList = res.response || [];
    for (const entry of teamList) {
      const t = entry.team;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      results.push({ id: t.id, name: t.name, logo: t.logo, source: 'af', leagueId: null });
      if (results.length >= limit) break;
    }
  } catch(e) {}

  // 3. 按联赛球队列表过滤（补充搜索）
  if (results.length < 3) {
    const afLeagueId = league ? getAfLeagueId(league) : 39;
    try {
      const res = await afGet(`/teams?league=${afLeagueId}&season=${season}`);
      const teamList = res.response || [];
      for (const entry of teamList) {
        const t = entry.team;
        if (seen.has(t.id)) continue;
        const score = teamMatch(query, t.name);
        if (!score) continue;
        seen.add(t.id);
        results.push({ id: t.id, name: t.name, logo: t.logo, source: 'af-list', leagueId: afLeagueId, matchScore: score });
        if (results.length >= limit) break;
      }
    } catch(e) {}
  }

  // 4. football-data.org 搜索
  const fdCode = league ? getFdLeagueCode(league) : null;
  if (fdCode) {
    const teams = await searchTeamsFDB(query, fdCode);
    for (const t of teams) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      results.push({ id: t.id, name: t.name, logo: t.logo, source: 'fdb', leagueId: fdCode });
      if (results.length >= limit) break;
    }
  }

  // 按匹配质量排序（别名=2 > 完全包含=2 > 模糊=1），返回前 limit 条
  results.sort((a, b) => ((b.matchScore || 0) - (a.matchScore || 0)));
  return results.slice(0, limit);
}

// football-data.org 球队搜索
async function searchTeamsFDB(query, leagueCode) {
  if (!leagueCode) return [];
  try {
    // 用 /competitions/{id}/teams 获取联赛球队
    const res = await fdGet(`/competitions/${leagueCode}/teams`);
    const teams = res.teams || [];
    return teams
      .filter(t => teamMatch(query, t.name))
      .map(t => ({ id: t.id, name: t.name, logo: t.crest || '' }));
  } catch(e) {
    return [];
  }
}

// ─── 比赛搜索（模糊：联赛+时间+场次+主客队）────────────────────────────────────
/**
 * 模糊搜索比赛
 * @param {object} params - { league, date, weekday, matchNo, home, away, limit }
 * @returns {Array} 比赛列表 [{id, home, away, league, date, time, matchNo}]
 */
async function searchMatches(params = {}) {
  const { league, date, weekday, matchNo, home, away, limit = 20 } = params;
  const results = [];
  const seen = new Set();

  // 从竞彩编号推断日期
  let targetDate = date;
  if (!targetDate && weekday && matchNo) {
    const wd = parseInt(weekday);
    if (wd >= 1 && wd <= 7) {
      const today = new Date();
      const todayWd = today.getDay() === 0 ? 7 : today.getDay();
      let diff = wd - todayWd;
      if (diff < 0) diff += 7;
      const d = new Date(today);
      d.setDate(today.getDate() + diff);
      targetDate = d.toISOString().substring(0, 10);
    }
  }

  // 1. API-Football 搜索
  try {
    const afId = league ? getAfLeagueId(league) : null;
    let path = `/fixtures?season=2024&status=FT,SBT,2HT,1HT,PST,NS`;
    if (targetDate) path += `&date=${targetDate}`;
    if (afId) path += `&league=${afId}`;
    if (limit) path += `&limit=${limit}`;

    const res = await afGet(path);
    const matches = res.response || [];
    for (const f of matches) {
      const homeName = f.teams?.home?.name || '';
      const awayName = f.teams?.away?.name || '';
      // 模糊过滤（teamMatch 容忍拼写差异）
      if (home && !teamMatch(home, homeName) && !teamMatch(home, awayName)) continue;
      if (away && !teamMatch(away, homeName) && !teamMatch(away, awayName)) continue;
      const id = f.fixture?.id;
      if (seen.has(id)) continue;
      seen.add(id);
      results.push({
        id,
        home: homeName,
        away: awayName,
        homeId: f.teams?.home?.id,
        awayId: f.teams?.away?.id,
        league: f.league?.name,
        leagueId: f.league?.id,
        date: f.fixture?.date?.substring(0, 10),
        time: f.fixture?.date?.substring(11, 16),
        status: f.fixture?.status?.short,
        score: f.goals ? `${f.goals.home}-${f.goals.away}` : null,
      });
      if (results.length >= limit) break;
    }
  } catch(e) {}

  // 2. football-data.org 搜索
  const fdMatches = await searchMatchesFDB({ league, date: targetDate, home, away, limit });
  for (const f of fdMatches) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    results.push(f);
    if (results.length >= limit) break;
  }

  return results.slice(0, limit);
}

// football-data.org 比赛搜索
async function searchMatchesFDB({ league, date, home, away, limit = 20 }) {
  const results = [];
  const fdCode = league ? getFdLeagueCode(league) : null;
  try {
    let path = '/matches?';
    if (fdCode) path += `competitions=${fdCode}&`;
    if (date) path += `dateFrom=${date}&dateTo=${date}&`;
    path += `limit=${limit}`;
    const res = await fdGet(path);
    const matches = res.matches || [];
    for (const f of matches) {
      const homeName = f.homeTeam?.shortName || f.homeTeam?.name || '';
      const awayName = f.awayTeam?.shortName || f.awayTeam?.name || '';
      if (home && !teamMatch(home, homeName) && !teamMatch(home, awayName)) continue;
      if (away && !teamMatch(away, homeName) && !teamMatch(away, awayName)) continue;
      results.push({
        id: f.id,
        home: homeName,
        away: awayName,
        homeId: f.homeTeam?.id,
        awayId: f.awayTeam?.id,
        league: f.competition?.name,
        leagueId: f.competition?.id,
        date: f.utcDate?.substring(0, 10),
        time: f.utcDate?.substring(11, 16),
        status: f.status,
        score: f.score?.fullTime ? `${f.score.fullTime.home}-${f.score.fullTime.away}` : null,
      });
    }
  } catch(e) {}
  return results;
}

// ─── 积分榜 ──────────────────────────────────────────────────────────────────
async function getTeamStandings(teamId, leagueName) {
  const afId = getAfLeagueId(leagueName);
  try {
    const res = await afGet(`/standings?league=${afId}&season=2024`);
    const allRows = res.response?.[0]?.league?.standings?.flat() || [];
    const row = allRows.find(r => r.team.id === teamId);
    if (!row) return null;
    return {
      rank: row.rank, points: row.points,
      played: row.all?.played, wins: row.all?.win, draws: row.all?.draw, losses: row.all?.lose,
      goalsFor: row.all?.goals?.for, goalsAgainst: row.all?.goals?.against,
      goalDiff: row.goalsDiff,
    };
  } catch(e) { return null; }
}

// ─── 近况 ────────────────────────────────────────────────────────────────────
async function getTeamForm(teamId, leagueName) {
  const afId = getAfLeagueId(leagueName);
  try {
    const res = await afGet(`/teams/statistics?league=${afId}&season=2024&team=${teamId}`);
    const s = res.response || {};
    const formStr = s.form || '';
    const last6 = formStr.split('').slice(-6);
    const hw = s.fixtures?.wins?.home || 0, hd = s.fixtures?.draws?.home || 0, hl = s.fixtures?.loses?.home || 0;
    const aw = s.fixtures?.wins?.away || 0, ad = s.fixtures?.draws?.away || 0, al = s.fixtures?.loses?.away || 0;
    return last6.map(c => ({
      formChar: c,
      result: c === 'W' ? '胜' : c === 'L' ? '负' : '平',
      homeRecord: `${hw}胜${hd}平${hl}负`,
      awayRecord: `${aw}胜${ad}平${al}负`,
    }));
  } catch(e) { return []; }
}

// ─── 历史交锋 ────────────────────────────────────────────────────────────────
async function getHeadToHead(teamA, teamB, leagueName) {
  const afId = getAfLeagueId(leagueName);
  try {
    const res = await afGet(`/fixtures?h2h=${teamA}-${teamB}&season=2024&status=FT&limit=6&league=${afId}`);
    return (res.response || []).map(f => {
      const aIsHome = f.teams.home.id === teamA;
      const aGoals = aIsHome ? f.goals.home : f.goals.away;
      const bGoals = aIsHome ? f.goals.away : f.goals.home;
      return {
        result: aGoals > bGoals ? '胜' : aGoals < bGoals ? '负' : '平',
        aScore: aGoals, bScore: bGoals,
        date: f.fixture.date.substring(0, 10),
        league: f.league.name,
        venue: aIsHome ? '主' : '客',
      };
    });
  } catch(e) { return []; }
}

// ─── 场均数据 ────────────────────────────────────────────────────────────────
async function getTeamStats(teamId, leagueName) {
  const afId = getAfLeagueId(leagueName);
  try {
    const res = await afGet(`/teams/statistics?league=${afId}&season=2024&team=${teamId}`);
    const s = res.response || {};
    const played = s.fixtures?.played?.total || 0;
    const gf = typeof s.goals?.for?.total === 'object' ? s.goals.for.total.total : (s.goals?.for?.total || 0);
    const ga = typeof s.goals?.against?.total === 'object' ? s.goals.against.total.total : (s.goals?.against?.total || 0);
    const cs = typeof s.clean_sheet?.total === 'object' ? s.clean_sheet.total.total : (s.clean_sheet?.total || 0);
    return {
      goalsPerGame: played > 0 ? (gf / played).toFixed(2) : '?',
      concededPerGame: played > 0 ? (ga / played).toFixed(2) : '?',
      totalGoalsFor: gf, totalGoalsAgainst: ga,
      matchesPlayed: played,
      wins: s.fixtures?.wins?.total || 0,
      draws: s.fixtures?.draws?.total || 0,
      losses: s.fixtures?.loses?.total || 0,
      cleanSheets: cs,
    };
  } catch(e) { return null; }
}

// ─── 完整基本面（双源）────────────────────────────────────────────────────────
async function getMatchContext(sweepRecord) {
  const { home_team, away_team, league, match_time, weekday, match_no } = sweepRecord;
  const ctx = { home: {}, away: {}, h2h: [], loading: true };

  try {
    // 并行：双源搜索球队
    const [homeTeamAF, awayTeamAF, homeResults, awayResults] = await Promise.all([
      findTeamAF(home_team, league),
      findTeamAF(away_team, league),
      searchTeams(home_team, { league }),
      searchTeams(away_team, { league }),
    ]);

    // 优先用别名精确结果，否则取第一个模糊搜索结果
    const homeT = homeTeamAF || homeResults[0];
    const awayT = awayTeamAF || awayResults[0];

    if (!homeT) { ctx.error = `未找到主队: ${home_team}`; ctx.loading = false; return ctx; }
    if (!awayT) { ctx.error = `未找到客队: ${away_team}`; ctx.loading = false; return ctx; }

    ctx.home.id = homeT.id; ctx.home.name = homeT.name; ctx.home.logo = homeT.logo;
    ctx.away.id = awayT.id; ctx.away.name = awayT.name; ctx.away.logo = awayT.logo;
    const lgId = getAfLeagueId(league);

    // 并行获取所有数据
    const [homeStand, awayStand, homeForm, awayForm, h2h, homeStats, awayStats] = await Promise.all([
      getTeamStandings(homeT.id, league),
      getTeamStandings(awayT.id, league),
      getTeamForm(homeT.id, league),
      getTeamForm(awayT.id, league),
      getHeadToHead(homeT.id, awayT.id, league),
      getTeamStats(homeT.id, league),
      getTeamStats(awayT.id, league),
    ]);

    ctx.home.standings = homeStand; ctx.away.standings = awayStand;
    ctx.home.form = homeForm; ctx.away.form = awayForm;
    ctx.home.stats = homeStats; ctx.away.stats = awayStats;
    ctx.h2h = h2h;
    ctx.summary = buildSummary(ctx);
    ctx.loading = false;
  } catch(e) {
    ctx.error = '获取数据失败: ' + e.message; ctx.loading = false;
  }
  return ctx;
}

// 通过别名精确查 API-Football 球队
async function findTeamAF(name) {
  if (!name) return null;
  const q = name.toLowerCase().trim();
  for (const [alias, id] of Object.entries(TEAM_ALIAS)) {
    const a = alias.toLowerCase();
    if (a === q || a.startsWith(q) || q.startsWith(a)) {
      try {
        const res = await afGet(`/teams?id=${id}&season=2024&league=39`);
        if (res.response?.[0]) {
          const t = res.response[0].team;
          return { id: t.id, name: t.name, logo: t.logo };
        }
      } catch(e) {}
    }
  }
  return null;
}

// ─── 摘要格式化 ──────────────────────────────────────────────────────────────
function buildSummary(ctx) {
  const lines = [], h = ctx.home, a = ctx.away;
  if (h.standings && a.standings) {
    lines.push('【积分榜】');
    lines.push(`  ${h.name}: 第${h.standings.rank}名 ${h.standings.points}分 (${h.standings.wins}胜${h.standings.draws}平${h.standings.losses}负) 进球${h.standings.goalsFor}失球${h.standings.goalsAgainst}`);
    lines.push(`  ${a.name}: 第${a.standings.rank}名 ${a.standings.points}分 (${a.standings.wins}胜${a.standings.draws}平${a.standings.losses}负) 进球${a.standings.goalsFor}失球${a.standings.goalsAgainst}`);
  }
  if (h.form?.length) {
    const last = h.form[h.form.length - 1];
    lines.push(`【近况】${h.name}: ${h.form.map(f=>f.formChar).join('')} (${h.form.map(f=>f.result).join('')}); 主场 ${last.homeRecord}; 客场 ${last.awayRecord}`);
  }
  if (a.form?.length) {
    const last = a.form[a.form.length - 1];
    lines.push(`【近况】${a.name}: ${a.form.map(f=>f.formChar).join('')} (${a.form.map(f=>f.result).join('')}); 主场 ${last.homeRecord}; 客场 ${last.awayRecord}`);
  }
  if (h.stats && a.stats) {
    lines.push(`【场均】${h.name}: 场均进球${h.stats.goalsPerGame} 失${h.stats.concededPerGame} | ${a.name}: 场均进球${a.stats.goalsPerGame} 失${a.stats.concededPerGame}`);
  }
  if (ctx.h2h?.length) {
    const hw = ctx.h2h.filter(m => m.result === '胜').length;
    const aw = ctx.h2h.filter(m => m.result === '负').length;
    const dr = ctx.h2h.length - hw - aw;
    lines.push(`【交锋】近${ctx.h2h.length}场: ${h.name}${hw}胜 ${dr}平 ${aw}胜${a.name}`);
  }
  return lines.join('\n');
}

// ─── 导出 ────────────────────────────────────────────────────────────────────
module.exports = {
  searchTeams,
  searchMatches,
  findTeamAF,
  getTeamStandings,
  getTeamForm,
  getHeadToHead,
  getTeamStats,
  getMatchContext,
  buildSummary,
  fuzzyMatch,
};
