const https = require('https');
const url = 'dreamtipper-api.onrender.com';

function call(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: url, path, method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        ...(token ? {} : {})
      }
    }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    req.on('error', e => resolve({ status: 0, body: 'ERR: ' + e.message }));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // 1. 创建普通会员测试账号
  const email = 'test_member_' + Date.now() + '@test.com';
  const reg = await call('POST', '/api/auth/register', { email, password: 'test1234', nickname: '测试会员' });
  console.log('注册:', reg.status, reg.body.slice(0, 100));

  if (reg.status !== 200 && reg.status !== 201) {
    // 账号已存在，改用登录
    const login2 = await call('POST', '/api/auth/login', { email: 'test_member@test.com', password: 'test1234' });
    console.log('登录已有账号:', login2.status, login2.body.slice(0, 100));
    const tok2 = JSON.parse(login2.body).token;
    const sweep2 = await call('GET', '/api/sweep?limit=3', null, tok2);
    console.log('已有账号 sweep:', sweep2.status, 'total=', JSON.parse(sweep2.body).total, 'records=', JSON.parse(sweep2.body).records.length);
    process.exit(0);
  }

  const tok = JSON.parse(reg.body).token;
  console.log('token:', tok?.substring(0, 30), '...');

  // 2. 用该 token 查扫盘数据
  const sweep = await call('GET', '/api/sweep?limit=3', null, tok);
  console.log('会员扫盘:', sweep.status);
  try {
    const j = JSON.parse(sweep.body);
    console.log('  total:', j.total, '| records:', j.records.length);
    if (j.records.length > 0) {
      console.log('  第1条:', j.records[0].league, '| odds:', j.records[0].odds, '| handicap:', j.records[0].handicap, '| tier_required:', j.records[0].tier_required);
    }
  } catch (e) {
    console.log('  解析错误:', sweep.body.slice(0, 200));
  }

  // 3. 无 token 查扫盘
  const sweepPublic = await call('GET', '/api/sweep?limit=2');
  console.log('公开扫盘:', sweepPublic.status);
  try {
    const j = JSON.parse(sweepPublic.body);
    console.log('  total:', j.total, '| records:', j.records.length);
    if (j.records.length > 0) {
      console.log('  第1条 odds:', j.records[0].odds, '| handicap:', j.records[0].handicap, '| tier_required:', j.records[0].tier_required);
    }
  } catch (e) {
    console.log('  解析错误:', sweepPublic.body.slice(0, 200));
  }

  // 4. 检查后台该会员的 tier
  const me = await call('GET', '/api/auth/me', null, tok);
  console.log('me:', me.status, me.body.slice(0, 100));

  process.exit(0);
})();
