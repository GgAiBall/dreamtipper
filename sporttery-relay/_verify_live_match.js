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
// 经本机 relay 拉当前竞彩在售/直播列表
function liveList() {
  return new Promise((resolve) => {
    const t = 'https://webapi.sporttery.cn/gateway/uniform/fb/getMatchLiveV1.qry?matchIds=&eventTc=goals,penalty_shootout&method=live';
    const proxy = 'https://lovely-plums-heal.loca.lt';
    const u = new URL(proxy + '?url=' + encodeURIComponent(t));
    const r = https.request({ method: 'GET', hostname: u.hostname, port: u.port, path: u.pathname + u.search, timeout: 20000 }, res => {
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(c).toString('utf8'))); } catch (e) { resolve(null); }
      });
    });
    r.on('error', () => resolve(null)); r.end();
  });
}
(async () => {
  const live = await liveList();
  const arr = live && live.value ? live.value : [];
  console.log('live count', arr.length);
  arr.slice(0, 5).forEach(m => console.log('  ', m.matchNum, m.matchNumStr, m.homeTeamAllName, 'vs', m.awayTeamAllName, 'status', m.matchStatus, 'score', m.sectionsNo999));
  // 找一个已结束(finished)的，保证有比分
  const fin = arr.find(m => m.matchStatus === '11') || arr[0];
  if (!fin) { console.log('no live match'); return; }
  const wd = Math.floor(Number(fin.matchNum) / 1000);
  const no = String(Number(fin.matchNum) % 1000).padStart(3, '0');
  console.log('will test weekday', wd, 'match_no', no, 'score', fin.sectionsNo999);
  const login = await req('POST', '/api/auth/login', null, { email: 'admin@dreamtipper.com', password: 'admin123' });
  const token = login.j.token;
  const add = await req('POST', '/api/admin/sweep', token, {
    league: '测试', home_team: '测试主', away_team: '测试客', match_time: '2026-09-17 18:00',
    handicap: '[]', odds: null, odds_type: 'decimal', confidence_stars: 3, tier_required: 'free',
    result: 'pending', status: 'pending', category: '人工扫盘', weekday: wd, match_no: no
  });
  const id = add.j.id; console.log('upload', add.status, id);
  if (id) {
    const fr = await req('POST', '/api/admin/sweep/' + id + '/fetch-result', token);
    console.log('FETCH-RESULT ->', JSON.stringify(fr.j));
    await req('DELETE', '/api/admin/sweep/' + id, token);
    console.log('cleaned');
  }
})().catch(e => console.log('ERR', e.message));
