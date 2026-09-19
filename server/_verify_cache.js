const https = require('https');
function req(o, b) {
  return new Promise((res, rej) => {
    const r = https.request(o, x => {
      const c = []; x.on('data', d => c.push(d));
      x.on('end', () => { try { res({ s: x.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); }
        catch (e) { res({ s: x.statusCode, body: null }); }
      });
    }); r.on('error', rej); if (b) r.write(b); r.end();
  });
}
(async () => {
  const H = 'dreamtipper-api.onrender.com';
  const l = await req({ hostname: H, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@dreamtipper.com', password: 'admin123' }));
  const t = l.body.token;
  // 取一条有缓存的记录
  const r = await req({ hostname: H, path: '/api/admin/sweep?limit=3', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const rec = r.body.records.find(r => r.sporttery_match_id) || r.body.records[0];
  console.log('测试记录:', rec.home_team, 'vs', rec.away_team, '| smid:', rec.sporttery_match_id);
  // 拉缓存数据
  const ctx = await req({ hostname: H, path: '/api/admin/sweep/' + rec.id + '/sporttery-context?type=all', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  console.log('fromCache:', ctx.body.fromCache);
  console.log('feature ok:', ctx.body.feature?.ok, '| data keys:', ctx.body.feature?.data ? Object.keys(ctx.body.feature.data).length : 0);
  console.log('history ok:', ctx.body.history?.ok, '| matchList len:', ctx.body.history?.data?.matchList?.length);
  console.log('tables ok:', ctx.body.tables?.ok, '| data keys:', ctx.body.tables?.data ? Object.keys(ctx.body.tables.data).length : 0);
  console.log('future ok:', ctx.body.future?.ok, '| future matchList len:', ctx.body.future?.data?.home?.matchList?.length || 0, '/', ctx.body.future?.data?.away?.matchList?.length || 0);
  // 再测另一条新关联的
  const r2 = await req({ hostname: H, path: '/api/admin/sweep?limit=100', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const rec2 = r2.body.records.find(r => r.sporttery_match_id && r.home_team.includes('皇马'));
  if (rec2) {
    console.log('\n--- 马德里竞技 vs 皇家马德里 ---');
    const ctx2 = await req({ hostname: H, path: '/api/admin/sweep/' + rec2.id + '/sporttery-context?type=feature', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
    const d = ctx2.body.feature?.data;
    console.log('feature ok:', ctx2.body.feature?.ok, '| homeTeam:', d?.awayTeamShortName, '| last key:', d ? Object.keys(d).slice(0, 5).join(',') : 'null');
  }
})().catch(e => console.log('ERR:', e.message));
