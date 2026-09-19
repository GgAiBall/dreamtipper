const https = require('https');
function get(u) {
  return new Promise((res, rej) => {
    const x = new URL(u);
    https.get({ hostname: x.hostname, port: 443, path: x.pathname + x.search,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.sporttery.cn/' } },
      r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => {
        try { res(JSON.parse(Buffer.concat(c).toString())); }
        catch (e) { res({ raw: Buffer.concat(c).toString().slice(0, 100) }); }
      }); }).on('error', rej);
  });
}
(async () => {
  const B = 'https://webapi.sporttery.cn/gateway/uniform/football/';
  const r = await get(B + 'getMatchListV1.qry?clientCode=3001');
  const groups = r.value?.matchInfoList || [];
  console.log('groups:', groups.length);
  let total = 0;
  for (const g of groups) {
    const sub = g.subMatchList || [];
    total += sub.length;
    for (const m of sub) {
      console.log(m.matchNumStr, m.homeTeam, 'vs', m.awayTeam, '| status:', m.matchStatus, '| matchId:', m.matchId);
    }
  }
  console.log('total matches:', total);
})().catch(e => console.log('ERR', e.message));
