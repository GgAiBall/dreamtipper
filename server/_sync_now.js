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
  const KEY = 'dt-sync-2026';
  // dry-run
  const r = await req({ hostname: H, path: '/api/sync/sporttery?dry_run=1', method: 'GET', headers: { 'x-sync-key': KEY } });
  console.log('dry-run status:', r.s);
  if (r.body) console.log(JSON.stringify(r.body).slice(0, 500));
  // real sync
  if (r.body && (r.body.new > 0 || r.body.updated > 0)) {
    const s = await req({ hostname: H, path: '/api/sync/sporttery', method: 'POST', headers: { 'x-sync-key': KEY, 'Content-Type': 'application/json' } }, JSON.stringify({}));
    console.log('sync status:', s.s);
    if (s.body) console.log(JSON.stringify(s.body).slice(0, 300));
  }
})().catch(e => console.log('ERR', e.message));
