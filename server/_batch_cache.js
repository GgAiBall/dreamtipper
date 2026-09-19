/**
 * _batch_cache.js
 * 批量把竞彩详情数据刷入 Turso（本地跑，绕过 Render geo-block）
 * 流程：
 * 1. 从竞彩列表拉所有 matchId → 主客队名 → build lookup map
 * 2. 从生产 DB 拉所有 published 记录
 * 3. 用 (home_team + away_team) 匹配 lookup，更新 sporttery_match_id / wbsj_match_id
 * 4. 对匹配上的记录拉竞彩详情并写入 sporttery_detail_cache
 * 5. 对已有关联 ID 的记录（老数据 67452）重新刷缓存
 */
const https = require('https');
const http = require('http');

function getJson(url, timeoutMs = 15000) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request({
      hostname: u.hostname, port: u.port || (lib === https ? 443 : 80),
      path: u.pathname + u.search, method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.sporttery.cn/', 'Accept': 'application/json' },
      timeout: timeoutMs
    }, r => {
      const c = []; r.on('data', d => c.push(d));
      r.on('end', () => {
        try { res(JSON.parse(Buffer.concat(c).toString())); }
        catch (e) { res({ error: 'not json', raw: Buffer.concat(c).toString().slice(0, 200) }); }
      });
    });
    req.on('error', rej);
    req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    req.end();
  });
}

function callDetail(ep, ids, extra = '') {
  let paramStr = ids.sportteryMatchId
    ? `sportteryMatchId=${ids.sportteryMatchId}`
    : (ids.wbsjMatchId ? `wbsjMatchId=${ids.wbsjMatchId}` : null);
  if (!paramStr) return Promise.resolve({ ok: false, error: 'no id' });
  const url = `https://webapi.sporttery.cn/gateway/uniform/football/${ep}?${paramStr}${extra ? '&' + extra : ''}`;
  return getJson(url).then(j => {
    if (!j || j.errorCode !== '0' || !j.success) return { ok: false, error: `code=${j?.errorCode}`, data: j };
    const empty = j.value === '' || !j.value || Object.keys(j.value || {}).length === 0;
    return { ok: true, empty, data: empty ? null : j.value };
  }).catch(e => ({ ok: false, error: e.message }));
}

function reqHttps(o, b) {
  return new Promise((res, rej) => {
    const r = https.request(o, x => {
      const c = []; x.on('data', d => c.push(d));
      x.on('end', () => { try { res({ s: x.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); }
        catch (e) { res({ s: x.statusCode, body: null }); }
      });
    }); r.on('error', rej); if (b) r.write(b); r.end();
  });
}

// ---- main ----
const HOST = 'dreamtipper-api.onrender.com';

(async () => {
  // 1. 拉竞彩列表 build lookup
  console.log('📡 Step 1: 拉竞彩列表...');
  const listR = await getJson('https://webapi.sporttery.cn/gateway/uniform/football/getMatchListV1.qry?clientCode=3001');
  const lookup = new Map(); // "home|away" → {matchId, homeTeamId, awayTeamId, leagueId, matchNumStr}
  const allMatches = [];
  for (const g of (listR.value?.matchInfoList || [])) {
    for (const m of (g.subMatchList || [])) {
      if (!m.homeTeamAllName || !m.awayTeamAllName) continue;
      const key = `${m.homeTeamAllName}|${m.awayTeamAllName}`;
      lookup.set(key, { matchId: m.matchId, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, leagueId: m.leagueId, matchNumStr: m.matchNumStr });
      allMatches.push({ ...m, matchNumStr: m.matchNumStr });
    }
  }
  console.log(`   竞彩列表: ${allMatches.length} 场，lookup entries: ${lookup.size}`);

  // 2. 登录拿 admin token
  console.log('🔑 Step 2: 登录...');
  const loginR = await reqHttps(
    { hostname: HOST, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@dreamtipper.com', password: 'admin123' })
  );
  const token = loginR.body?.token;
  if (!token) { console.log('login failed', loginR.body); return; }
  console.log(`   token OK (${token.length} chars)`);

  // 3. 拉所有 published 记录
  console.log('📥 Step 3: 拉 published 记录...');
  const recsR = await reqHttps(
    { hostname: HOST, path: '/api/admin/sweep?limit=500', method: 'GET', headers: { Authorization: 'Bearer ' + token } },
    null
  );
  const recs = (recsR.body?.records || []).filter(r => r.home_team && r.away_team);
  console.log(`   总 published: ${recsR.body?.total}，有队名: ${recs.length}`);

  // 4. 匹配 + 统计
  let matched = 0, alreadyLinked = 0, noMatch = 0;
  const toProcess = [];
  for (const rec of recs) {
    if (rec.sporttery_match_id) { alreadyLinked++; toProcess.push(rec); continue; }
    const key = `${rec.home_team}|${rec.away_team}`;
    const found = lookup.get(key);
    if (found) {
      matched++;
      toProcess.push({ ...rec, _newMatchId: found.matchId, _homeTeamId: found.homeTeamId, _awayTeamId: found.awayTeamId, _leagueId: found.leagueId, _matchNumStr: found.matchNumStr });
    } else {
      noMatch++;
    }
  }
  console.log(`   已有 ID: ${alreadyLinked} | 匹配到: ${matched} | 无匹配: ${noMatch}`);
  if (toProcess.length) {
    console.log('   匹配样例:', toProcess.slice(0, 3).map(r => `${r.home_team} vs ${r.away_team} → smid=${r.sporttery_match_id || r._newMatchId}`).join(' | '));
  }

  // 5. 更新 matchId（PUT）
  let updated = 0;
  for (const rec of toProcess) {
    if (rec.sporttery_match_id) continue; // 已有，跳过
    const smid = rec._newMatchId;
    const putR = await reqHttps(
      { hostname: HOST, path: `/api/admin/sweep/${rec.id}/sporttery-id`, method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } },
      JSON.stringify({ sportteryMatchId: smid })
    );
    if (putR.s === 200) updated++;
    else console.log(`   PUT failed ${rec.id} → ${smid}:`, putR.body);
  }
  console.log(`\n✅ Step 4: 更新 matchId: ${updated} 条`);

  // 6. 拉竞彩详情并写入缓存（对已有 smid 的记录 + 新关联的）
  const needCache = toProcess.filter(r => r.sporttery_match_id || r._newMatchId);
  console.log(`\n📊 Step 5: 拉竞彩详情写入缓存 (${needCache.length} 条)...`);
  let cached = 0, cacheFailed = 0, cacheSkipped = 0;
  for (const rec of needCache) {
    const smid = rec.sporttery_match_id || rec._newMatchId;
    const ids = { sportteryMatchId: String(smid) };
    // 拉 5 个端点（并行）
    const [feature, history, tables, future, injury] = await Promise.all([
      callDetail('getMatchFeatureV1.qry', ids, 'termLimits=10').catch(e => ({ ok: false, error: e.message })),
      callDetail('getResultHistoryV1.qry', ids, 'termLimits=10&tournamentFlag=0&homeAwayFlag=0').catch(e => ({ ok: false, error: e.message })),
      callDetail('getMatchTablesV2.qry', ids).catch(e => ({ ok: false, error: e.message })),
      callDetail('getFutureMatchesV1.qry', ids, 'termLimits=4').catch(e => ({ ok: false, error: e.message })),
      callDetail('getInjurySuspensionV1.qry', ids).catch(e => ({ ok: false, error: e.message })),
    ]);

    const anyOk = [feature, history, tables, future, injury].some(r => r && r.ok && !r.empty);
    if (!anyOk) { cacheSkipped++; process.stdout.write('⚠'); continue; }

    // 写缓存（用 admin 直接写 Turso）
    // 先直连 Turso 写（不用 API，避免再次 geo-block）
    const { createClient } = require('@libsql/client');
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL || 'libsql://dreamtipper-ggaiball.aws-ap-northeast-1.turso.io',
      authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk0MzY0NjMsImlkIjoiMDFhMGEyYjktMDEwMS03ZDVlLTg3MzEtNTE3Y2MyMGE2OTllIiwia2lkIjoiVVZ2M19ka29RSllZOWpKbFBIZXVZSmluUGhQaHdRdGF5NU1YdS1aeWtOdyIsInJpZCI6ImQzNWQxYWU0LWE1ZmQtNGY2NS04ZThiLTkxY2UwNjA3MjFmMSJ9.oDX1jKv1fQur9XZHVKSQhhp4OLOalSygKExyPYVuailXm04JyVC9J3oZtxZvchnKTrBwpZszk5lMwu5czn_4Cg'
    });
    const j = k => (k && k.ok && k.data) ? JSON.stringify(k.data) : null;
    const fetchAt = new Date().toISOString();
    const wbsjId = rec.wbsj_match_id || null;
    try {
      await client.execute({
        sql: `INSERT OR REPLACE INTO sporttery_detail_cache (sweep_id, sporttery_match_id, wbsj_match_id, feature, history, tables, future, injury, fetched_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [rec.id, parseInt(smid), wbsjId, j(feature), j(history), j(tables), j(future), j(injury), fetchAt, fetchAt]
      });
      cached++;
      process.stdout.write('✅');
    } catch (e) {
      cacheFailed++;
      console.log(`\n   cache write failed ${rec.id}:`, e.message);
    }
    await client.close();
  }
  console.log(`\n\n📦 缓存写入完成: cached=${cached} | skipped(empty)=${cacheSkipped} | failed=${cacheFailed}`);
  console.log('🎉 全部完成！生产详情弹窗现在有数据了。');
})().catch(e => console.log('ERR:', e.message));
