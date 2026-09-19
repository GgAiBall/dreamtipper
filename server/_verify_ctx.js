const http = require('http');
function req(opts, body) {
  return new Promise((res, rej) => {
    const r = http.request(opts, resp => {
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
(async () => {
  const login = await req(
    { hostname: 'localhost', port: 3002, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ email: 'admin@dreamtipper.com', password: 'admin123' })
  );
  const token = login.body.token;
  console.log('login', login.status, 'token.len', token && token.length);
  const list = await req(
    { hostname: 'localhost', port: 3002, path: '/api/admin/sweep?limit=2', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('list total', list.body.total);
  const rec = list.body.records[0];
  console.log('first', rec.id, rec.home_team, 'vs', rec.away_team, 'smid', rec.sporttery_match_id, 'wbsj', rec.wbsj_match_id);
  // 测未关联时的错误提示
  const ctx = await req(
    { hostname: 'localhost', port: 3002, path: '/api/admin/sweep/' + rec.id + '/sporttery-context', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('context-no-id ok', ctx.body.ok, '| err', ctx.body.error, '| detailUrl', ctx.body.detailUrl);
  // 手动设 sporttery_match_id = 67452 测真实数据
  const put = await req(
    { hostname: 'localhost', port: 3002, path: '/api/admin/sweep/' + rec.id + '/sporttery-id', method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } },
    JSON.stringify({ sportteryMatchId: 67452 })
  );
  console.log('put-id', put.status, JSON.stringify(put.body));
  const ctx2 = await req(
    { hostname: 'localhost', port: 3002, path: '/api/admin/sweep/' + rec.id + '/sporttery-context?type=all', method: 'GET', headers: { Authorization: 'Bearer ' + token } }
  );
  console.log('context-with-67452 ok', ctx2.body.ok);
  console.log('  feature ok', ctx2.body.feature && ctx2.body.feature.ok, '| tables ok', ctx2.body.tables && ctx2.body.tables.ok, '| history ok', ctx2.body.history && ctx2.body.history.ok);
  console.log('  detailUrl', ctx2.body.detailUrl);
})().catch(e => console.log('ERR', e.message));
