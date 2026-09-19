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
  // 看返回的完整字段
  const r = await req({ hostname: H, path: '/api/admin/sweep?limit=2', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const rec = r.body.records[0];
  console.log('fields:', Object.keys(rec).join(','));
  console.log('home_team:', JSON.stringify(rec.home_team), '| away_team:', JSON.stringify(rec.away_team), '| league:', JSON.stringify(rec.league));
  console.log('full record:', JSON.stringify(rec).slice(0, 500));
})().catch(e => console.log('ERR', e.message));
