/**
 * sportteryDetail.js — 竞彩官网详情数据封装
 * 数据源：https://webapi.sporttery.cn/gateway/uniform/football/
 * 6 个端点：特征分析 / 历史交锋 / 积分榜 / 已结算比分 / 未来赛事 / 伤停
 *
 * 所有端点都需要 sportteryMatchId（mid）；fallback 接受 wbsj_matchId (gm)
 * 数据来源：static.sporttery.cn/res_1_0/jcw/default/jc/zqbsComponent.js
 */
const https = require('https');
const http = require('http');

const BASE = 'https://webapi.sporttery.cn/gateway/uniform/football/';
const REFERER = 'https://www.sporttery.cn/';

function getJson(url, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (lib === https ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Referer': REFERER,
        'Accept': 'application/json,text/plain,*/*'
      },
      timeout: timeoutMs
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const j = JSON.parse(body);
          resolve({ status: res.statusCode, json: j, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, json: null, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// 通用 fetch：拼 sportteryMatchId 或 wbsjMatchId（fallback）
async function callDetail(endpoint, { sportteryMatchId, wbsjMatchId, extra = '' }) {
  let paramStr = '';
  if (sportteryMatchId) paramStr = `sportteryMatchId=${encodeURIComponent(sportteryMatchId)}`;
  else if (wbsjMatchId) paramStr = `wbsjMatchId=${encodeURIComponent(wbsjMatchId)}`;
  else return { ok: false, error: '缺少 sportteryMatchId 或 wbsjMatchId' };

  const url = `${BASE}${endpoint}?${paramStr}${extra ? '&' + extra : ''}`;
  try {
    const { status, json } = await getJson(url);
    if (!json) return { ok: false, error: `HTTP ${status} 非 JSON 响应` };
    if (json.errorCode !== '0' || !json.success) {
      return { ok: false, error: `竞彩返回错误: ${json.errorCode || 'unknown'} ${json.errorMessage || ''}`, raw: json };
    }
    // value 是 "" 或 {} 表示没数据
    const empty = json.value === '' || (typeof json.value === 'object' && Object.keys(json.value || {}).length === 0);
    return { ok: true, empty, data: empty ? null : json.value };
  } catch (e) {
    return { ok: false, error: `请求失败: ${e.message}` };
  }
}

// ============ 6 个具体端点 ============

// 特征分析（6 维：last/sameHomeAway/eachHomeAway/eachSameHomeAway/home/away）
async function getMatchFeature(ids, termLimits = 10) {
  return callDetail('getMatchFeatureV1.qry', { ...ids, extra: `termLimits=${termLimits}` });
}

// 历史交锋（matchList + statistics：胜平负统计）
async function getResultHistory(ids, termLimits = 10, tournamentFlag = 0, homeAwayFlag = 0) {
  return callDetail('getResultHistoryV1.qry', {
    ...ids,
    extra: `termLimits=${termLimits}&tournamentFlag=${tournamentFlag}&homeAwayFlag=${homeAwayFlag}`
  });
}

// 积分榜（总/主/客）
async function getMatchTables(ids) {
  // 积分榜端点优先用 gmMatchId（= sportteryMatchId 的别名）
  const idParam = ids.sportteryMatchId
    ? `gmMatchId=${encodeURIComponent(ids.sportteryMatchId)}`
    : (ids.wbsjMatchId ? `wbsjMatchId=${encodeURIComponent(ids.wbsjMatchId)}` : null);
  if (!idParam) return { ok: false, error: '缺少 sportteryMatchId 或 wbsjMatchId' };
  try {
    const { json } = await getJson(`${BASE}getMatchTablesV2.qry?${idParam}`);
    if (!json || json.errorCode !== '0' || !json.success) {
      return { ok: false, error: '竞彩返回错误', raw: json };
    }
    const empty = !json.value || Object.keys(json.value).length === 0;
    return { ok: true, empty, data: empty ? null : json.value };
  } catch (e) { return { ok: false, error: e.message }; }
}

// 已结算比分（半全场比分）
async function getMatchResult(ids) {
  return callDetail('getMatchResultV1.qry', ids);
}

// 未来赛事
async function getFutureMatches(ids, termLimits = 4) {
  return callDetail('getFutureMatchesV1.qry', { ...ids, extra: `termLimits=${termLimits}` });
}

// 伤停
async function getInjurySuspension(ids) {
  return callDetail('getInjurySuspensionV1.qry', ids);
}

// 一站式：返回全部端点数据（前端基本信息弹窗用）
async function getAll(ids) {
  const [feature, history, tables, result, future, injury] = await Promise.all([
    getMatchFeature(ids, 10).catch(e => ({ ok: false, error: e.message })),
    getResultHistory(ids, 10).catch(e => ({ ok: false, error: e.message })),
    getMatchTables(ids).catch(e => ({ ok: false, error: e.message })),
    getMatchResult(ids).catch(e => ({ ok: false, error: e.message })),
    getFutureMatches(ids, 4).catch(e => ({ ok: false, error: e.message })),
    getInjurySuspension(ids).catch(e => ({ ok: false, error: e.message }))
  ]);
  return { feature, history, tables, result, future, injury };
}

// 详情页跳转 URL
function detailUrl(sportteryMatchId, wbsjMatchId) {
  if (sportteryMatchId) return `https://www.sporttery.cn/jc/zqdz/index.html?showType=2&mid=${sportteryMatchId}`;
  if (wbsjMatchId) return `https://www.sporttery.cn/jc/zqdz/index.html?showType=2&gm=${wbsjMatchId}`;
  return null;
}

module.exports = {
  getMatchFeature,
  getResultHistory,
  getMatchTables,
  getMatchResult,
  getFutureMatches,
  getInjurySuspension,
  getAll,
  detailUrl
};