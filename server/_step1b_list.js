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
  const r = await req({ hostname: H, path: '/api/admin/sweep?limit=200', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const recs = r.body.records.filter(r => r.wbsj_match_id || r.sporttery_match_id);
  console.log('total:', r.body.total, '| with any id:', recs.length);
  const withWbsj = r.body.records.filter(r => r.wbsj_match_id);
  const withSmid = r.body.records.filter(r => r.sporttery_match_id);
  console.log('with wbsj:', withWbsj.length, '| with smid:', withSmid.length);
  if (withWbsj.length) withWbsj.slice(0, 5).forEach(r => console.log('  wbsj:', r.wbsj_match_id, r.home_team, 'vs', r.away_team));
  if (withSmid.length) withSmid.slice(0, 3).forEach(r => console.log('  smid:', r.sporttery_match_id, r.home_team, 'vs', r.away_team));
  // 样本看字段
  if (r.body.records.length) {
    const s = r.body.records[0];
    const keys = Object.keys(s).filter(k => k.includes('id') || k.includes('match'));
    console.log('sample keys:', keys.join(','));
    console.log('sample:', JSON.stringify(s).slice(0, 300));
  }
})().catch(e => console.log('ERR', e.message));
