const https = require('https');
function call(m, path, body, token) {
  return new Promise(resolve => {
    const data = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json', 'host': 'dreamtipper-api.onrender.com' };
    if (data) h['Content-Length'] = Buffer.byteLength(data);
    if (token) h['Authorization'] = 'Bearer ' + token;
    const r = https.request({ hostname: 'dreamtipper-api.onrender.com', path, method: m, headers: h }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode, b: d }));
    });
    if (data) r.write(data); r.end();
  });
}
(async () => {
  const a = await call('POST', '/api/auth/login', { email: 'admin@dreamtipper.com', password: 'admin123' });
  const tok = JSON.parse(a.b).token;
  const m = await call('GET', '/api/admin/members', null, tok);
  const j = JSON.parse(m.b);
  console.log('members count:', j.total || j.users?.length);
  j.users?.forEach(u => console.log(' ', u.email, '|tier:', u.subscription_tier, '|pwd:', u.password_hash ? 'has' : 'none'));
  
  // 尝试注册新用户
  const reg = await call('POST', '/api/auth/register', { email: '123456@qq.com', password: 'test1234', nickname: '测试用户' });
  console.log('register 123456@qq.com:', reg.s, reg.b.slice(0, 80));
  
  // 登录
  const login = await call('POST', '/api/auth/login', { email: '123456@qq.com', password: 'test1234' });
  console.log('login:', login.s, login.b.slice(0, 80));
  
  if (login.s === 200) {
    const tok2 = JSON.parse(login.b).token;
    const ul = await call('GET', '/api/purchases/unlocks-left', null, tok2);
    console.log('unlocks-left:', ul.b);
    
    // 找锁定记录
    const sw = await call('GET', '/api/sweep?limit=20', null, tok2);
    const sj = JSON.parse(sw.b);
    const locked = sj.records.find(r => r.odds === null);
    console.log('locked records:', sj.records.filter(r=>r.odds===null).length);
    if (locked) {
      const u1 = await call('POST', '/api/purchases/unlock/' + locked.id, null, tok2);
      console.log('unlock #1:', u1.s, u1.b.slice(0,80));
      const ul2 = await call('GET', '/api/purchases/unlocks-left', null, tok2);
      console.log('after:', ul2.b);
      
      const u2 = await call('POST', '/api/purchases/unlock/' + sj.records.find(r=>r.odds===null&&r.id!==locked.id)?.id, null, tok2);
      console.log('unlock #2:', u2.s, u2.b.slice(0,80));
      
      const u3 = await call('POST', '/api/purchases/unlock/' + sj.records.find(r=>r.odds===null)?.id, null, tok2);
      console.log('unlock #3:', u3.s, u3.b.slice(0,80));
      
      const u4 = await call('POST', '/api/purchases/unlock/' + sj.records.find(r=>r.odds===null)?.id, null, tok2);
      console.log('unlock #4 (should 403):', u4.s, u4.b.slice(0,80));
    }
  }
  console.log('DONE'); process.exit(0);
})();
