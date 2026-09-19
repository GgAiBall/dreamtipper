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
  // 打印所有 matchId 对应的队伍名，建立 reverse map
  for (const g of groups) {
    for (const m of g.subMatchList || []) {
      if (m.homeTeamAllName && m.awayTeamAllName) {
        console.log(`${m.homeTeamAllName}|${m.awayTeamAllName}|${m.matchNumStr}|${m.matchId}|${m.homeTeamId}|${m.awayTeamId}|${m.leagueId}`);
      }
    }
  }
})().catch(e => console.log('ERR', e.message));
