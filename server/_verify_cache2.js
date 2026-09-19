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
  // 拉所有记录，找有 sporttery_match_id 的
  const r = await req({ hostname: H, path: '/api/admin/sweep?limit=200', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const withId = r.body.records.filter(r => r.sporttery_match_id);
  console.log('records with smid:', withId.length);
  if (withId.length === 0) { console.log('no records with sporttery_match_id yet'); return; }
  for (const rec of withId.slice(0, 3)) {
    console.log(`\n测试: ${rec.home_team} vs ${rec.away_team} | smid=${rec.sporttery_match_id}`);
    const ctx = await req({ hostname: H, path: '/api/admin/sweep/' + rec.id + '/sporttery-context?type=feature', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
    const feat = ctx.body.feature;
    console.log('  feature ok:', feat?.ok, '| empty:', feat?.empty, '| data keys:', feat?.data ? Object.keys(feat.data).length : 'null');
    const hist = ctx.body.history;
    console.log('  history ok:', hist?.ok, '| matchList:', hist?.data?.matchList?.length);
    const tabs = ctx.body.tables;
    console.log('  tables ok:', tabs?.ok, '| keys:', tabs?.data ? Object.keys(tabs.data).length : 'null');
    const fut = ctx.body.future;
    console.log('  future ok:', fut?.ok, '| home/future:', fut?.data?.home?.matchList?.length, '| away:', fut?.data?.away?.matchList?.length);
    const inj = ctx.body.injury;
    console.log('  injury ok:', inj?.ok, '| data:', inj?.data ? JSON.stringify(inj.data).slice(0, 100) : 'null');
  }
})().catch(e => console.log('ERR:', e.message));
