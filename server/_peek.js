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
  console.log('=== GROUP[0] keys:', Object.keys(groups[0] || {}).join(','));
  const sub = groups[0]?.subMatchList || [];
  console.log('=== SUB[0] keys:', Object.keys(sub[0] || {}).join(','));
  // 打印前3条的完整数据
  for (let i = 0; i < Math.min(3, sub.length); i++) {
    const m = sub[i];
    console.log('\n--- sub[' + i + '] ---');
    console.log('matchNumStr:', m.matchNumStr, '| matchNum:', m.matchNum, '| matchId:', m.matchId);
    console.log('homeTeamAllName:', m.homeTeamAllName, '| awayTeamAllName:', m.awayTeamAllName);
    console.log('homeTeamAbbName:', m.homeTeamAbbName, '| awayTeamAbbName:', m.awayTeamAbbName);
    console.log('leagueAllName:', m.leagueAllName, '| leagueAbbName:', m.leagueAbbName);
    console.log('matchStatus:', m.matchStatus, '| matchTime:', m.matchTime);
    console.log('matchId:', m.matchId, '| wbsj_matchId:', m.wbsj_match_id, '| any id:', Object.keys(m).filter(k => k.includes('Id') || k.includes('ID')));
  }
})().catch(e => console.log('ERR', e.message));
