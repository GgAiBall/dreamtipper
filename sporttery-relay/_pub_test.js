const https = require('https');
const t = 'https://webapi.sporttery.cn/gateway/uniform/fb/getMatchLiveV1.qry?matchIds=&eventTc=goals,penalty_shootout&method=live';
const proxy = process.argv[2] || 'https://cknjk-14-153-19-208.run.pinggy-free.link';
const target = proxy + (proxy.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(t);
const u = new URL(target);
const r = https.request({ method: 'GET', hostname: u.hostname, port: u.port, path: u.pathname + u.search, timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*' } }, res => {
  const c = []; res.on('data', d => c.push(d)); res.on('end', () => {
    let j; try { j = JSON.parse(Buffer.concat(c).toString('utf8')); } catch (e) { j = { __err: e.message, raw: Buffer.concat(c).toString('utf8').slice(0, 120) }; }
    console.log('via PUBLIC tunnel -> status', res.statusCode, '| value len', j.value ? j.value.length : '-', '| first matchNum', j.value && j.value[0] ? j.value[0].matchNum : '-');
  });
});
r.on('error', e => console.log('ERR', e.message));
r.on('timeout', () => { r.destroy(); console.log('TIMEOUT'); });
r.end();
