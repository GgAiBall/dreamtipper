/**
 * API-Football 服务模块
 * 基于 https://v3.football.api-sports.io
 * 免费版: 100次/天，只能查 2022-2024 赛季
 */
const https = require('https');

const API_KEY = process.env.FOOTBALL_API_KEY || '28bd489ab98dba2ed1b0f78827408ee5';
const BASE_URL = 'https://v3.football.api-sports.io';
const SEASON = 2024; // 免费版只支持 2022-2024

// 常用联赛ID映射
const LEAGUE_MAP = {
  '英超': 39, '英格兰超级联赛': 39, 'Premier League': 39,
  '西甲': 140, '西班牙甲级联赛': 140, 'La Liga': 140,
  '意甲': 135, '意大利甲级联赛': 135, 'Serie A': 135,
  '德甲': 78, '德国甲级联赛': 78, 'Bundesliga': 78,
  '法甲': 61, '法国甲级联赛': 61, 'Ligue 1': 61,
  '中超': 169, '中国超级联赛': 169, 'CSL': 169,
  'J联赛': 98, 'J1': 98, 'J-League': 98,
  'K联赛': 292, 'K-League': 292,
  '欧冠': 2, '欧洲冠军联赛': 2, 'Champions League': 2,
  '欧罗巴': 3, '欧联': 3, 'Europa League': 3,
};

// 球队名模糊映射表（解决中英文/缩写差异）
const TEAM_ALIAS = {
  // 英文别名
  'arsenal': 42, '阿森纳': 42, '兵工厂': 42,
  'manchester united': 33, 'man u': 33, 'mu': 33, '曼联': 33, '红魔': 33,
  'liverpool': 40, '利物浦': 40, '红军': 40,
  'manchester city': 50, 'man city': 50, '曼城': 50, '蓝月亮': 50,
  'chelsea': 49, '切尔西': 49, '蓝军': 49,
  'tottenham': 47, 'spurs': 47, '热刺': 47, '托特纳姆': 47,
  'newcastle': 34, '纽卡斯尔': 34, '喜鹊': 34,
  'brighton': 51, '布莱顿': 51,
  'aston villa': 464, 'villa': 464, '维拉': 464, '阿斯顿维拉': 464,
  'west ham': 48, '西汉姆': 48, '铁锤帮': 48,
  'fulham': 36, '富勒姆': 36, '农场主': 36,
  'wolves': 39, 'wolverhampton': 39, '狼队': 39,
  'bournemouth': 35, '伯恩茅斯': 35, '樱桃': 35,
  'crystal palace': 52, '水晶宫': 52, '老鹰': 52,
  'brentford': 55, '布伦特福德': 55, '蜜蜂': 55,
  'everton': 45, '埃弗顿': 45, '太妃糖': 45,
  'leicester': 46, 'leicester city': 46, '莱斯特': 46, '蓝狐': 46,
  'nottingham forest': 65, 'forest': 65, '诺丁汉': 65, '森林': 65,
  'ipswich': 1039, '伊普斯维奇': 1039,
  'southampton': 41, '南安普顿': 41, '圣徒': 41,
  'leeds': 63, 'leeds united': 63, '利兹': 63, '利兹联': 63,
  'burnley': 44, '伯恩利': 44, '红酒': 44,
  'luton': 62, 'luton town': 62, '卢顿': 62,
  'sheffield utd': 62, 'sheffield united': 62, '谢菲联': 62,
  'Ajax': 43, '阿贾克斯': 43,
  'Bayern': 157, '拜仁': 157, '拜仁慕尼黑': 157,
  'Real Madrid': 541, '皇马': 541, '皇家马德里': 541,
  'Barcelona': 529, '巴萨': 529, '巴塞罗那': 529,
  'Inter': 505, '国际米兰': 505,
  'Milan': 489, 'AC Milan': 489, 'AC米兰': 489, '米兰': 489,
  'Juventus': 496, '尤文': 496, '尤文图斯': 496,
  'Napoli': 492, '那不勒斯': 492,
  'Roma': 487, '罗马': 487,
  'Atletico': 530, '马竞': 530, '马德里竞技': 530,
  'Sevilla': 536, '塞维利亚': 536,
  'Dortmund': 165, '多特蒙德': 165,
  'RB Leipzig': 173, '莱比锡': 173, 'RB莱比锡': 173,
  'Leverkusen': 168, '勒沃库森': 168,
  'Frankfurt': 167, '法兰克福': 167,
  'PSG': 85, '巴黎': 85, '巴黎圣日耳曼': 85,
  'Marseille': 81, '马赛': 81,
  'Monaco': 91, '摩纳哥': 91,
  'Lyon': 80, '里昂': 80,
  'Lille': 79, '里尔': 79,
  '上港': 3055, '上海海港': 3055, '上海上港': 3055,
  '国安':  3053, '北京国安': 3053,
  '山东泰山': 3064, '泰山': 3064,
  '广州': 3061, '广州队': 3061, '广州恒大': 3061,
  '上海绿地': 3056, '上海绿地绿地': 3056, '上海绿地': 3056,
  '武汉三镇': 11282, '三镇': 11282,
  '成都蓉城': 11284, '蓉城': 11284,
  '浙江': 3069, '浙江队': 3069,
  '河南': 3063, '河南嵩山': 3063,
  '天津': 3060, '天津津门虎': 3060,
  '深圳': 3065, '深圳队': 3065,
  '海港': 3055, '青岛': 3059, '青岛海牛': 3059,
  '南通': 11315, '南通支云': 11315,
  '沧州': 11316, '沧州雄狮': 11316,
  '梅州': 11293, '梅州客家': 11293,
  '成都': 11284,
  '横滨水手': 10471, ' Yokohama': 10471,
  '川崎': 10472, '川崎前锋': 10472,
  '鹿岛': 10473, '鹿岛鹿角': 10473,
  '神户': 10474, '神户胜利': 10474,
  '东京': 10475, 'FC东京': 10475,
  '柏太阳神': 10476, '大阪': 10477, '大阪樱花': 10477,
};

// 球队ID缓存（按 league-season）
const teamCache = {};

function httpGetJson(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'x-apisports-key': API_KEY, 'Accept': 'application/json' }
    };
    const req = https.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.errors && json.errors.length > 0) {
            console.error('[footballApi] API error:', JSON.stringify(json.errors));
          }
          resolve(json);
        } catch (e) {
          resolve({ error: 'parse_error', raw: d.substring(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

/**
 * 搜索球队 by name (用别名映射或 league+season 全量匹配)
 * @param {string} name - 球队名称
 * @param {number} leagueId - 可选，联赛ID
 * @returns {object|null} 球队信息 {id, name, logo}
 */
async function findTeam(name, leagueId) {
  if (!name) return null;
  const q = name.toLowerCase().trim();

  // 1. 查别名表
  for (const [alias, id] of Object.entries(TEAM_ALIAS)) {
    if (q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
      // 用 ID 反查球队信息
      const res = await httpGetJson(`/teams?id=${id}&season=${SEASON}&league=39`);
      if (!res.response || res.response.length === 0) return null;
      if (res.response?.[0]) {
        return { id, name: res.response[0].team.name, logo: res.response[0].team.logo };
      }
    }
  }

  // 2. 用 league 查全量球队列表再本地匹配（search 和 season 不能同时用）
  if (leagueId) {
    const cacheKey = `${leagueId}-${SEASON}`;
    let teamList = teamCache[cacheKey];
    if (!teamList) {
      const res = await httpGetJson(`/teams?league=${leagueId}&season=${SEASON}`);
      teamList = res.response || [];
      teamCache[cacheKey] = teamList;
    }
    const exact = teamList.find(t => t.team.name.toLowerCase() === q);
    if (exact) return { id: exact.team.id, name: exact.team.name, logo: exact.team.logo };
    const fuzzy = teamList.find(t =>
      t.team.name.toLowerCase().includes(q) || q.includes(t.team.name.toLowerCase()) ||
      (t.team.alias && (t.team.alias.toLowerCase().includes(q) || q.includes(t.team.alias.toLowerCase())))
    );
    if (fuzzy) return { id: fuzzy.team.id, name: fuzzy.team.name, logo: fuzzy.team.logo };
  }

  return null;
}

/**
 * 获取球队积分榜排名
 * @param {number} teamId
 * @param {number} leagueId
 */
async function getTeamStandings(teamId, leagueId = 39) {
  const res = await httpGetJson(`/standings?league=${leagueId}&season=${SEASON}`);
  if (!res.response?.[0]?.league?.standings) return null;
  const allRows = res.response[0].league.standings.flat();
  const row = allRows.find(r => r.team.id === teamId);
  if (!row) return null;
  return {
    rank: row.rank,
    points: row.points,
    played: row.all.played,
    wins: row.all.win,
    draws: row.all.draw,
    losses: row.all.lose,
    goalsFor: row.all.goals.for,
    goalsAgainst: row.all.goals.against,
    goalDiff: row.goalsDiff,
  };
}

/**
 * 获取球队近期战绩摘要（从 teams/statistics 的 form + 主客场统计获取）
 * 由于 team 和 league 参数不能同时用于 fixtures 接口，用统计接口代替
 * @param {number} teamId
 * @param {number} leagueId
 */
async function getTeamForm(teamId, leagueId = 39) {
  const res = await httpGetJson(`/teams/statistics?league=${leagueId}&season=${SEASON}&team=${teamId}`);
  if (!res.response) return [];
  const s = res.response;
  const formStr = s.form || '';
  // 主客场战绩
  const hw = s.fixtures?.wins?.home || 0;
  const hd = s.fixtures?.draws?.home || 0;
  const hl = s.fixtures?.loses?.home || 0;
  const aw = s.fixtures?.wins?.away || 0;
  const ad = s.fixtures?.draws?.away || 0;
  const al = s.fixtures?.loses?.away || 0;
  const homeRecord = `${hw}胜${hd}平${hl}负`;
  const awayRecord = `${aw}胜${ad}平${al}负`;
  // 从 form 字符串还原近6场摘要
  const last6 = formStr.split('').slice(-6);
  return last6.map(c => ({
    formChar: c,
    result: c === 'W' ? '胜' : c === 'L' ? '负' : '平',
    homeRecord,
    awayRecord,
  }));
}

/**
 * 获取两队历史交锋
 * @param {number} teamA
 * @param {number} teamB
 * @param {number} limit
 */
async function getHeadToHead(teamA, teamB, leagueId = 39, limit = 6) {
  const res = await httpGetJson(`/fixtures?h2h=${teamA}-${teamB}&season=${SEASON}&status=FT&limit=${limit}&league=${leagueId}`);
  if (!res.response) return [];
  return res.response.map(f => {
    const aIsHome = f.teams.home.id === teamA;
    const aGoals = aIsHome ? f.goals.home : f.goals.away;
    const bGoals = aIsHome ? f.goals.away : f.goals.home;
    const result = aGoals > bGoals ? '胜' : aGoals < bGoals ? '负' : '平';
    return {
      result,
      aScore: aGoals,
      bScore: bGoals,
      date: f.fixture.date.substring(0, 10),
      league: f.league.name,
      venue: aIsHome ? '主' : '客',
    };
  });
}

/**
 * 根据 match_no + weekday 找今日/近期比赛
 * @param {number} weekday 1=周一...7=周日
 * @param {string} matchNo 场次号如 "001"
 * @param {string} date 日期 YYYY-MM-DD
 */
async function findMatchByNo(weekday, matchNo, date) {
  const d = date ? new Date(date) : new Date();
  const targetDate = date || d.toISOString().substring(0, 10);
  const res = await httpGetJson(`/fixtures?date=${targetDate}&season=${SEASON}`);
  if (!res.response || res.response.length === 0) return null;
  // 找竞彩编号对应场次（取当天第N场比赛）
  const n = parseInt(matchNo, 10);
  if (isNaN(n) || n < 1) return null;
  const matches = res.response;
  if (n > matches.length) return null;
  return matches[n - 1];
}

/**
 * 获取比赛详情
 * @param {number} fixtureId
 */
async function getFixtureDetails(fixtureId) {
  const res = await httpGetJson(`/fixtures?id=${fixtureId}`);
  if (!res.response?.[0]) return null;
  return res.response[0];
}

/**
 * 获取球队赛季统计（场均进球/失球）
 * @param {number} teamId
 * @param {number} leagueId
 */
async function getTeamStats(teamId, leagueId = 39) {
  const res = await httpGetJson(`/teams/statistics?league=${leagueId}&season=${SEASON}&team=${teamId}`);
  if (!res.response) return null;
  const s = res.response;
  // 路径说明: goals.for.total = { home:35, away:34, total:69 } → 取 .total 得数字 69
  // fixtures.played.total = { home:19, away:19, total:38 } → 取 .total 得数字 38
  // goals.for.total = {home:35, away:34, total:69} → 取 .total 得 69
  // goals.against.total = 同结构
  // clean_sheet.total = {home:7, away:6, total:13}
  // fixtures.played.total = 数字 38（直接用）
  // fixtures.wins/draws/loses.total = 数字（直接用）
  const played = s.fixtures?.played?.total || 0;
  const gf = typeof s.goals?.for?.total === 'object' ? s.goals.for.total.total : (s.goals?.for?.total || 0);
  const ga = typeof s.goals?.against?.total === 'object' ? s.goals.against.total.total : (s.goals?.against?.total || 0);
  const cs = typeof s.clean_sheet?.total === 'object' ? s.clean_sheet.total.total : (s.clean_sheet?.total || 0);
  return {
    goalsPerGame: played > 0 ? (gf / played).toFixed(2) : '?',
    concededPerGame: played > 0 ? (ga / played).toFixed(2) : '?',
    totalGoalsFor: gf,
    totalGoalsAgainst: ga,
    matchesPlayed: played,
    wins: s.fixtures?.wins?.total || 0,
    draws: s.fixtures?.draws?.total || 0,
    losses: s.fixtures?.loses?.total || 0,
    cleanSheets: cs,
  };
}

/**
 * 整合一场比赛的完整基本面数据（给 AI 分析用）
 * @param {object} sweepRecord - 扫盘记录 {home_team, away_team, league, match_time}
 */
async function getMatchContext(sweepRecord) {
  const { home_team, away_team, league } = sweepRecord;
  const context = {
    home: {},
    away: {},
    h2h: [],
    loading: true,
  };

  try {
    // 找两队 ID
    const [homeTeam, awayTeam] = await Promise.all([
      findTeam(home_team),
      findTeam(away_team),
    ]);

    if (!homeTeam || !awayTeam) {
      context.error = '未找到球队: ' + (!homeTeam ? home_team : away_team);
      context.loading = false;
      return context;
    }

    context.home.id = homeTeam.id;
    context.home.name = homeTeam.name;
    context.away.id = awayTeam.id;
    context.away.name = awayTeam.name;

    // 从联赛名推断 leagueId
    const leagueId = inferLeagueId(league);

    // 并行获取所有数据
    const [homeStand, awayStand, homeForm, awayForm, h2h, homeStats, awayStats] = await Promise.all([
      getTeamStandings(homeTeam.id, leagueId),
      getTeamStandings(awayTeam.id, leagueId),
      getTeamForm(homeTeam.id, leagueId),
      getTeamForm(awayTeam.id, leagueId),
      getHeadToHead(homeTeam.id, awayTeam.id, leagueId),
      getTeamStats(homeTeam.id, leagueId),
      getTeamStats(awayTeam.id, leagueId),
    ]);

    context.home.standings = homeStand;
    context.away.standings = awayStand;
    context.home.form = homeForm;
    context.away.form = awayForm;
    context.home.stats = homeStats;
    context.away.stats = awayStats;
    context.h2h = h2h;

    // 格式化输出
    context.summary = buildContextSummary(context);
    context.loading = false;
  } catch (e) {
    context.error = '获取数据失败: ' + e.message;
    context.loading = false;
  }

  return context;
}

/**
 * 构建人类可读的上下文摘要
 */
function inferLeagueId(leagueName) {
  if (!leagueName) return 39; // 默认英超
  const l = leagueName.toLowerCase();
  for (const [key, id] of Object.entries(LEAGUE_MAP)) {
    if (l.includes(key.toLowerCase())) return id;
  }
  return 39;
}

function buildContextSummary(ctx) {
  const lines = [];
  const h = ctx.home, a = ctx.away;

  // 积分排名
  if (h.standings && a.standings) {
    lines.push(`【积分榜】`);
    lines.push(`  ${h.name}: 第${h.standings.rank}名 ${h.standings.points}分 (${h.standings.wins}胜${h.standings.draws}平${h.standings.losses}负) 进球${h.standings.goalsFor}失球${h.standings.goalsAgainst}`);
    lines.push(`  ${a.name}: 第${a.standings.rank}名 ${a.standings.points}分 (${a.standings.wins}胜${a.standings.draws}平${a.standings.losses}负) 进球${a.standings.goalsFor}失球${a.standings.goalsAgainst}`);
  }

  // 近期战绩（form 序列 + 主客场统计）
  if (h.form && h.form.length > 0) {
    const hFormStr = h.form.map(f => f.formChar).join('');
    const sample = h.form[h.form.length - 1];
    lines.push(`【近6场】${h.name}: ${hFormStr} (${h.form.map(f => f.result).join('')}); 主场: ${sample.homeRecord}; 客场: ${sample.awayRecord}`);
  }
  if (a.form && a.form.length > 0) {
    const aFormStr = a.form.map(f => f.formChar).join('');
    const sample = a.form[a.form.length - 1];
    lines.push(`【客队近6场】${a.name}: ${aFormStr} (${a.form.map(f => f.result).join('')}); 主场: ${sample.homeRecord}; 客场: ${sample.awayRecord}`);
  }

  // 场均数据
  if (h.stats && a.stats) {
    lines.push(`【场均数据】${h.name}: 场均进球${h.stats.goalsPerGame} 场均失球${h.stats.concededPerGame} 零封${h.stats.cleanSheets}次 | ${a.name}: 场均进球${a.stats.goalsPerGame} 场均失球${a.stats.concededPerGame} 零封${a.stats.cleanSheets}次`);
  }

  // 历史交锋
  if (ctx.h2h && ctx.h2h.length > 0) {
    const wins = ctx.h2h.filter(h => h.result === '胜').length;
    const draws = ctx.h2h.filter(h => h.result === '平').length;
    const losses = ctx.h2h.filter(h => h.result === '负').length;
    lines.push(`【历史交锋】近${ctx.h2h.length}场: ${h.name} ${wins}胜${draws}平${losses}负`);
    ctx.h2h.slice(0, 3).forEach(m => {
      lines.push(`  ${m.date} ${m.league}: ${m.aScore}-${m.bScore}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  findTeam,
  getTeamStandings,
  getTeamForm,
  getHeadToHead,
  findMatchByNo,
  getFixtureDetails,
  getTeamStats,
  getMatchContext,
  buildContextSummary,
};
