const https = require('https');
function req(o, b) {
  return new Promise((res, rej) => {
    const r = https.request(o, x => {
      const c = []; x.on('data', d => c.push(d));
      x.on('end', () => { try { res({ s: x.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); }
        catch (e) { res({ s: x.statusCode, raw: Buffer.concat(c).toString().slice(0, 1000) }); }
      });
    }); r.on('error', rej); if (b) r.write(b); r.end();
  });
}
(async () => {
  const H = 'dreamtipper-api.onrender.com';
  const l = await req({ hostname: H, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@dreamtipper.com', password: 'admin123' }));
  const t = l.body.token;
  const r = await req({ hostname: H, path: '/api/admin/sweep?limit=5', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const rec = r.body.records.find(r => r.sporttery_match_id) || r.body.records[0];
  console.log('rec id:', rec.id, 'smid:', rec.sporttery_match_id);
  const ctx = await req({ hostname: H, path: '/api/admin/sweep/' + rec.id + '/sporttery-context', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  console.log('status:', ctx.s);
  console.log('body keys:', Object.keys(ctx.body || {}).join(','));
  console.log('body:', JSON.stringify(ctx.body).slice(0, 1000));
})().catch(e => console.log('ERR:', e.message));
