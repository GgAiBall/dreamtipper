const https = require('https');
const BASE = 'https://dreamtipper-api.onrender.com';
function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(BASE + path);
    const r = https.request({ method, hostname: u.hostname, port: 443, path: u.pathname + u.search, timeout: 25000,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } }, res => {
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => {
        let j; try { j = JSON.parse(Buffer.concat(c).toString('utf8')); } catch (e) { j = { __raw: Buffer.concat(c).toString('utf8').slice(0, 200) }; }
        resolve({ status: res.statusCode, j });
      });
    });
    r.on('error', reject); r.on('timeout', () => { r.destroy(); reject(new Error('TIMEOUT')); });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const login = await req('POST', '/api/auth/login', null, { email: 'admin@dreamtipper.com', password: 'admin123' });
  const token = login.j.token; console.log('login status', login.status, 'tokenLen', token ? token.length : 0);
  const list = await req('GET', '/api/admin/sweep?limit=5', token);
  const rec = list.j.records && list.j.records[0];
  console.log('list total', list.j.total, 'first wd', rec && rec.weekday, 'no', rec && rec.match_no, 'id', rec && rec.id);
  if (rec) {
    const fr = await req('POST', '/api/admin/sweep/' + rec.id + '/fetch-result', token);
    console.log('FETCH-RESULT status', fr.status, '->', JSON.stringify(fr.j));
  }
})().catch(e => console.log('ERR', e.message));
