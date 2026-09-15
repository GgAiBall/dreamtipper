const https = require('https');
function call(m, path, body, token) {
  return new Promise(resolve => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json', 'host': 'dreamtipper-api.onrender.com' };
    if (data) h['Content-Length'] = Buffer.byteLength(data);
    if (token) h['Authorization'] = 'Bearer ' + token;
    const r = https.request({ hostname: 'dreamtipper-api.onrender.com', path, method: m, headers: h }, res2 => {
      let d = ''; res2.on('data', c => d += c); res2.on('end', () => resolve({ s: res2.statusCode, b: d }));
    });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const a = await call('POST', '/api/auth/login', { email: 'admin@dreamtipper.com', password: 'admin123' });
  const tok = JSON.parse(a.b).token;
  const m = await call('GET', '/api/admin/members', null, tok);
  const users = JSON.parse(m.b).users || [];
  const free = users.find(u => u.email === '123456@qq.com');
  console.log('free user unlock_used_today:', free?.unlock_used_today, 'unlock_date:', free?.unlock_date);

  // 用临时密码登录
  const login2 = await call('POST', '/api/auth/login', { email: '123456@qq.com', password: 'XRuVSzSP' });
  const body2 = JSON.parse(login2.b);
  if (!body2.token) { console.log('login fail:', login2.b.slice(0, 80)); process.exit(0); }
  const tok2 = body2.token;

  const ul1 = await call('GET', '/api/purchases/unlocks-left', null, tok2);
  console.log('unlocks-left:', ul1.s, ul1.b);

  // 找一条锁定记录
  const sw = await call('GET', '/api/sweep?limit=10', null, tok2);
  const sj = JSON.parse(sw.b);
  const locked = sj.records.find(r => r.odds === null);
  if (locked) {
    const u1 = await call('POST', '/api/purchases/unlock/' + locked.id, null, tok2);
    console.log('unlock #1:', u1.s, u1.b.slice(0, 80));
    const ul2 = await call('GET', '/api/purchases/unlocks-left', null, tok2);
    console.log('after #1:', ul2.s, ul2.b);
  } else {
    console.log('no locked records found');
  }
  console.log('DONE'); process.exit(0);
})();
