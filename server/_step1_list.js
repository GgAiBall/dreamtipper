const https = require('https');
function req(o, b) {
  return new Promise((res, rej) => {
    const r = https.request(o, x => {
      const c = []; x.on('data', d => c.push(d));
      x.on('end', () => { try { res({ s: x.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); }
        catch (e) { res({ s: x.statusCode, body: Buffer.concat(c).toString().slice(0, 200) }); }
      });
    }); r.on('error', rej); if (b) r.write(b); r.end();
  });
}
(async () => {
  const H = 'dreamtipper-api.onrender.com';
  const l = await req({ hostname: H, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@dreamtipper.com', password: 'admin123' }));
  const t = l.body.token;
  // 取所有有 wbsj_match_id 的记录
  const r = await req({ hostname: H, path: '/api/admin/sweep?limit=200&status=published', method: 'GET', headers: { Authorization: 'Bearer ' + t } });
  const recs = r.body.records.filter(r => r.wbsj_match_id || r.sporttery_match_id);
  console.log('total published:', r.body.total, '| with ids:', recs.length);
  for (const rec of recs) {
    console.log(rec.home_team, 'vs', rec.away_team, '| wbsj:', rec.wbsj_match_id, '| smid:', rec.sporttery_match_id, '| id:', rec.id);
  }
  if (recs.length === 0) console.log('no records with wbsj_match_id');
})().catch(e => console.log('ERR', e.message));
