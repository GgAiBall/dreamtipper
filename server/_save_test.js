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
  console.log('login:', a.s);

  // 测试保存一条扫盘（带 weekday/match_no）
  const payload = {
    league: '测试联赛', home_team: 'A队', away_team: 'B队',
    match_time: '2026-09-16T19:30', confidence_stars: 4, tier_required: 'free',
    odds_type: 'multi', handicap: JSON.stringify({ win_draw_loss: { pick: '胜', result: 'pending' } }),
    odds: 0, result: 'pending', weekday: 3, match_no: '001'
  };
  const save = await call('POST', '/api/admin/sweep', payload, tok);
  console.log('POST /admin/sweep:', save.s, save.b.slice(0, 200));

  // 测试不带 weekday（旧格式）
  const payload2 = {
    league: '测试联赛2', home_team: 'C队', away_team: 'D队',
    match_time: '2026-09-17T20:00', confidence_stars: 3, tier_required: 'free',
    odds_type: 'multi', handicap: JSON.stringify({ win_draw_loss: { pick: '负', result: 'pending' } }),
    odds: 0, result: 'pending'
  };
  const save2 = await call('POST', '/api/admin/sweep', payload2, tok);
  console.log('POST /admin/sweep (no weekday):', save2.s, save2.b.slice(0, 200));

  console.log('DONE'); process.exit(0);
})();
