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
  const token = login.j.token;
  // 上传一条 weekday=3(周三) match_no=001 的测试记录，匹配竞彩当前在售的亚运男足 周三001
  const add = await req('POST', '/api/admin/sweep', token, {
    league: '测试亚运', home_team: '测试主', away_team: '测试客', match_time: '2026-09-16 18:00',
    handicap: '[]', odds: null, odds_type: 'decimal', confidence_stars: 3, tier_required: 'free',
    result: 'pending', status: 'pending', category: '人工扫盘', weekday: 3, match_no: '001'
  });
  const id = add.j.id; console.log('upload status', add.status, 'id', id);
  if (id) {
    const fr = await req('POST', '/api/admin/sweep/' + id + '/fetch-result', token);
    console.log('FETCH-RESULT ->', JSON.stringify(fr.j));
    await req('DELETE', '/api/admin/sweep/' + id, token);
    console.log('cleaned up test record');
  }
})().catch(e => console.log('ERR', e.message));
