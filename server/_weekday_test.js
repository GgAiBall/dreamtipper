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
  // 管理员登录
  const a = await call('POST', '/api/auth/login', { email: 'admin@dreamtipper.com', password: 'admin123' });
  const tok = JSON.parse(a.b).token;
  
  // 拉全部扫盘
  const sw = await call('GET', '/api/admin/sweep?limit=5', null, tok);
  const j = JSON.parse(sw.b);
  console.log('total records:', j.total);
  j.records?.slice(0, 5).forEach(r => console.log(' ', r.id, 'wd='+r.weekday, 'no='+r.match_no, r.league, r.home_team+' VS '+r.away_team));
  
  // 测试 weekday=6 筛选（周六）
  const sw6 = await call('GET', '/api/admin/sweep?limit=3&weekday=6', null, tok);
  const j6 = JSON.parse(sw6.b);
  console.log('\nweekday=6 total:', j6.total);
  j6.records?.forEach(r => console.log(' ', r.id, 'wd='+r.weekday, 'no='+r.match_no));
  
  // 公开接口测试 weekday 筛选
  const pub = await call('GET', '/api/sweep?limit=3&weekday=6', null, null);
  const jp = JSON.parse(pub.b);
  console.log('\npublic weekday=6 total:', jp.total);
  jp.records?.forEach(r => console.log(' ', r.id, 'wd='+r.weekday, 'no='+r.match_no, r.league));
  
  console.log('\nDONE'); process.exit(0);
})();
