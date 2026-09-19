const https = require('https');
function req(opts, body) {
  return new Promise((res, rej) => {
    const r = https.request(opts, resp => {
      const c = [];
      resp.on('data', d => c.push(d));
      resp.on('end', () => {
        try { res({ status: resp.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); }
        catch (e) { res({ status: resp.statusCode, body: Buffer.concat(c).toString() }); }
      });
    });
    r.on('error', rej);
    if (body) r.write(body);
    r.end();
  });
}
const HOST = 'dreamtipper-api.onrender.com';
(async () => {
  const login = await req(
    { hostname: HOST, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@dreamtipper.com', password: 'admin123' })
  );
  const token = login.body.token;
  console.log('login', login.status, 'token.len', token && token.length);
  const list = await req(
    { hostname: HOST, path: '/api/admin/sweep?limit=3', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('list total', list.body.total);
  const rec = list.body.records.find(r => r.wbsj_match_id) || list.body.records[0];
  console.log('test rec', rec.id, rec.home_team, 'vs', rec.away_team, 'wbsj', rec.wbsj_match_id, 'smid', rec.sporttery_match_id);
  // 未关联时的错误提示
  const ctx = await req(
    { hostname: HOST, path: '/api/admin/sweep/' + rec.id + '/sporttery-context', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('NO-ID ok:', ctx.body.ok, '| err:', ctx.body.error);
  // 手动设 67452
  const put = await req(
    { hostname: HOST, path: '/api/admin/sweep/' + rec.id + '/sporttery-id', method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } },
    JSON.stringify({ sportteryMatchId: 67452 })
  );
  console.log('PUT', put.status, JSON.stringify(put.body));
  const ctx2 = await req(
    { hostname: HOST, path: '/api/admin/sweep/' + rec.id + '/sporttery-context?type=all', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('WITH-67452 ok:', ctx2.body.ok, '| detailUrl:', ctx2.body.detailUrl);
  console.log('  feature:', ctx2.body.feature && (ctx2.body.feature.ok + '/' + (ctx2.body.feature.empty ? 'empty' : 'has')));
  console.log('  tables:', ctx2.body.tables && (ctx2.body.tables.ok + '/' + (ctx2.body.tables.empty ? 'empty' : 'has')));
  console.log('  history:', ctx2.body.history && (ctx2.body.history.ok + '/' + (ctx2.body.history.empty ? 'empty' : 'has')));
})().catch(e => console.log('ERR', e.message));
