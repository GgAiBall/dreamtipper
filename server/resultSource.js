// resultSource.js —— 竞彩官网结果数据源
// 设计：
//  1) 若配置了 OFFICIAL_RESULT_API（返回一个带比分的 JSON 数组），按模板占位符请求并归一化（见 normalizeOfficial）。
//  2) 否则回退到竞彩官网公开的赛程接口 getMatchListV1.qry（webapi.sporttery.cn），
//     按「周几+场次编号」(matchNum = weekday*1000 + 场次) 匹配官方赛事，返回官方主客队/日期/状态。
//     该公开接口不含比分，故 score 为 null，由调用方决定是否等待结果接口。

const https = require('https');

const SPORTTERY_LIST_URL = 'https://webapi.sporttery.cn/gateway/uniform/football/getMatchListV1.qry?clientCode=3001';
const WD = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' };

function weekdayFromNum(n) { const w = Math.floor(n / 1000); return (w >= 1 && w <= 7) ? w : 0; }
function matchNoFromNum(n) { return String(n % 1000).padStart(3, '0'); }

function httpGetJson(url, timeoutMs) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (e) { return resolve(null); }
    const opt = {
      method: 'GET', hostname: u.hostname, path: u.pathname + u.search, timeout: timeoutMs || 15000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*', 'Referer': 'https://m.sporttery.cn/' },
    };
    const r = https.request(opt, res => {
      const c = []; res.on('data', d => c.push(d));
      res.on('end', () => { let j; try { j = JSON.parse(Buffer.concat(c).toString('utf8')); } catch (e) { j = null; } resolve(j); });
    });
    r.on('error', () => resolve(null));
    r.on('timeout', () => { r.destroy(); resolve(null); });
    r.end();
  });
}

// 自定义结果接口（OFFICIAL_RESULT_API）的归一化：把任意返回结构抽成标准官方结果
function normalizeOfficial(raw, ctx) {
  if (!raw) return null;
  // 兼容常见字段名
  const g = (keys) => { for (const k of keys) { if (raw[k] != null && raw[k] !== '') return raw[k]; } return null; };
  const hs = g(['home_score', 'homeScore', 'scoreHome', 'hostScore', 'home']);
  const as = g(['away_score', 'awayScore', 'scoreAway', 'guestScore', 'away']);
  const halfH = g(['home_halftime', 'halfHome', 'ht_home']);
  const halfA = g(['away_halftime', 'halfAway', 'ht_away']);
  const obj = {
    source: 'custom',
    matchNumStr: ctx ? (WD[ctx.weekday] || '') + (ctx.matchNo || '') : (g(['matchNumStr', 'num']) || ''),
    matchDate: g(['date', 'matchDate', 'match_time', 'kickoff']) || (ctx ? ctx.date : null),
    status: g(['status', 'state']) || 'finished',
    home_team: g(['home_team', 'homeTeam', 'home', 'host']),
    away_team: g(['away_team', 'awayTeam', 'away', 'guest']),
    league: g(['league', 'competition']),
    home_score: hs != null ? Number(hs) : null,
    away_score: as != null ? Number(as) : null,
    half_home: halfH != null ? Number(halfH) : null,
    half_away: halfA != null ? Number(halfA) : null,
  };
  if (obj.home_score == null && obj.away_score == null) return null;
  return obj;
}

async function fetchFromCustomApi(ctx) {
  const tpl = process.env.OFFICIAL_RESULT_API;
  if (!tpl) return null;
  const url = tpl
    .replace('{weekday}', ctx.weekday || '')
    .replace('{matchNo}', ctx.matchNo || '')
    .replace('{date}', ctx.date || '')
    .replace('{league}', encodeURIComponent(ctx.league || ''))
    .replace('{home}', encodeURIComponent(ctx.home || ''))
    .replace('{away}', encodeURIComponent(ctx.away || ''));
  const j = await httpGetJson(url, 15000);
  if (!j) return null;
  const arr = Array.isArray(j) ? j : (j.value && Array.isArray(j.value) ? j.value : (j.data && Array.isArray(j.data) ? j.data : (j.records || null)));
  if (arr) {
    // 按编号匹配
    const targetNum = (ctx.weekday || 0) * 1000 + parseInt(ctx.matchNo || '0', 10);
    const hit = arr.find(x => {
      const mn = x.matchNum != null ? Number(x.matchNum) : (x.num != null ? Number(x.num) : null);
      if (mn && mn === targetNum) return true;
      const ms = x.matchNumStr || x.numStr || '';
      return ms.replace(/\s/g, '') === ((WD[ctx.weekday] || '') + (ctx.matchNo || '')).replace(/\s/g, '');
    });
    return normalizeOfficial(hit || arr[0], ctx);
  }
  return normalizeOfficial(j, ctx);
}

async function fetchFromSporttery(ctx) {
  const targetNum = (ctx.weekday || 0) * 1000 + parseInt(ctx.matchNo || '0', 10);
  if (!ctx.weekday || !ctx.matchNo) return null;
  // 尝试默认（今日在售）+ 比赛日期 ±1 天，扩大命中窗口
  const dates = [];
  if (ctx.date) {
    const d = new Date(ctx.date);
    if (!isNaN(d.getTime())) for (let off = -1; off <= 1; off++) { const t = new Date(d); t.setDate(t.getDate() + off); dates.push(t.toISOString().slice(0, 10)); }
  }
  dates.push('');
  let all = [];
  for (const ds of dates) {
    const j = await httpGetJson(SPORTTERY_LIST_URL, 15000);
    const groups = j && j.value && j.value.matchInfoList;
    if (groups && groups.length) {
      for (const g of groups) {
        const subs = g.subMatchList || [];
        if (subs.length) {
          all = all.concat(subs);
          if (subs.some(m => m.matchNum === targetNum)) break;
        }
      }
    }
  }
  const match = all.find(m => m.matchNum === targetNum);
  if (!match) return null;
  const hasScore = match.homeScore != null || match.awayScore != null;
  return {
    source: 'sporttery',
    matchNum: match.matchNum,
    matchNumStr: (WD[weekdayFromNum(match.matchNum)] || '') + matchNoFromNum(match.matchNum),
    matchDate: match.matchDate || match.businessDate,
    status: match.matchStatus,
    home_team: null,           // 官网中文为 GBK 编码，此处不存（以本系统记录队名为准）
    away_team: null,
    league: null,
    home_score: match.homeScore != null ? Number(match.homeScore) : null,
    away_score: match.awayScore != null ? Number(match.awayScore) : null,
    half_home: match.homeHalfScore != null ? Number(match.homeHalfScore) : null,
    half_away: match.awayHalfScore != null ? Number(match.awayHalfScore) : null,
    note: hasScore ? '' : '已匹配竞彩官网赛事，当前公开接口未返回比分（比赛未结束，或需接入结果接口）',
  };
}

async function fetchOfficialResult(ctx) {
  // 优先自定义结果接口；否则回退竞彩官网赛程匹配
  if (process.env.OFFICIAL_RESULT_API) {
    try { const r = await fetchFromCustomApi(ctx); if (r) return r; } catch (e) { /* ignore */ }
  }
  return fetchFromSporttery(ctx);
}

// 依据官方比分 + 各玩法推荐，判定每盘红/黑，并汇总整单结果
function computeSweepResult(plays, official) {
  const hs = official.home_score, as = official.away_score;
  if (hs == null || as == null) return { plays, sweepResult: 'pending' };
  const goalDiff = hs - as;
  const decide = (mode, val) => {
    // 返回 'win' | 'loss' | 'push'
    if (val == null || val === '') return 'pending';
    switch (mode) {
      case 'win_draw_loss': {
        if (/主胜|胜/.test(val) && goalDiff > 0) return 'win';
        if (/平/.test(val) && goalDiff === 0) return 'push';
        if (/客胜|负/.test(val) && goalDiff < 0) return 'win';
        return 'loss';
      }
      case 'handicap': {
        // 让球，如 "主-0.5 胜" / "客+0.5 胜"
        const m = String(val).match(/([主客])([-+]?\d+(?:\.\d+)?)\s*(胜|负|平)/);
        if (!m) return 'pending';
        const side = m[1] === '主' ? 'home' : 'away';
        const line = parseFloat(m[2]);
        const pick = m[3];
        const eff = side === 'home' ? hs - line - as : as + line - hs;
        const actual = eff > 0 ? '胜' : (eff < 0 ? '负' : '平');
        return actual === pick ? 'win' : 'loss';
      }
      case 'score': {
        const m = String(val).match(/(\d+)\s*[:：]\s*(\d+)/);
        if (!m) return 'pending';
        return (parseInt(m[1], 10) === hs && parseInt(m[2], 10) === as) ? 'win' : 'loss';
      }
      case 'goals': {
        const m = String(val).match(/(\d+)/);
        if (!m) return 'pending';
        const total = hs + as;
        const guess = parseInt(m[1], 10);
        // 支持 "3球"/"3+" 等；精确匹配或区间
        if (/\+/.test(val)) return total >= guess ? 'win' : 'loss';
        return total === guess ? 'win' : 'loss';
      }
      case 'half_full': {
        // 半场/全场，如 "平/胜"
        const m = String(val).match(/([平胜负])\s*[/／]\s*([平胜负])/);
        if (!m || official.half_home == null || official.half_away == null) return 'pending';
        const hh = official.half_home - official.half_away;
        const hf = hh > 0 ? '胜' : (hh < 0 ? '负' : '平');
        const fh = goalDiff > 0 ? '胜' : (goalDiff < 0 ? '负' : '平');
        const wantH = m[1], wantF = m[2];
        return (hf === wantF && hf === wantF) ? 'win' : (hf === wantF && hf === wantF ? 'win' : 'loss'); // 简化为全场判定
      }
      default: return 'pending';
    }
  };
  const out = {};
  let wins = 0, losses = 0, pushes = 0, decided = 0;
  for (const k of Object.keys(plays)) {
    const p = plays[k];
    const r = decide(k, p.pick);
    out[k] = { pick: p.pick, result: r };
    if (r === 'win') { wins++; decided++; }
    else if (r === 'loss') { losses++; decided++; }
    else if (r === 'push') { pushes++; decided++; }
  }
  let sweepResult = 'pending';
  if (decided > 0) {
    if (losses === 0 && wins > 0) sweepResult = 'win';
    else if (wins === 0 && losses > 0) sweepResult = 'loss';
    else if (wins === 0 && losses === 0 && pushes > 0) sweepResult = 'push';
    else sweepResult = losses > wins ? 'loss' : (wins > losses ? 'win' : 'push');
  }
  return { plays: out, sweepResult };
}

module.exports = { fetchOfficialResult, computeSweepResult, normalizeOfficial };
