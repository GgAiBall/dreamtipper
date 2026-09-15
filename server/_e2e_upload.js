const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function call(m, path, body, token, isForm) {
  return new Promise((resolve, reject) => {
    const data = body;
    const h = { 'host': 'dreamtipper-api.onrender.com' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    let req;
    if (isForm) {
      const boundary = '----testboundary';
      h['Content-Type'] = 'multipart/form-data; boundary=' + boundary;
      req = https.request({ hostname: 'dreamtipper-api.onrender.com', path, method: m, headers: h }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode, b: d }));
      });
      req.write(data); req.end();
    } else {
      const payload = body ? JSON.stringify(body) : null;
      if (payload) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(payload); }
      req = https.request({ hostname: 'dreamtipper-api.onrender.com', path, method: m, headers: h }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ s: res.statusCode, b: d }));
      });
      if (payload) req.write(payload); req.end();
    }
  });
}

function buildMultipart(fields, file) {
  const boundary = '----testboundary';
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  const fileHead = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`);
  const fileEnd = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([...parts, fileHead, file.content, fileEnd]);
}

(async () => {
  // 1. login
  const a = await call('POST', '/api/auth/login', { email: 'admin@dreamtipper.com', password: 'admin123' });
  const tok = JSON.parse(a.b).token;
  console.log('login:', a.s);

  // 2. download template
  const tpl = await new Promise(resolve => {
    const req = https.request({ hostname: 'dreamtipper-api.onrender.com', path: '/api/admin/upload/template', method: 'GET', headers: { 'host': 'dreamtipper-api.onrender.com', 'Authorization': 'Bearer ' + tok } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ s: res.statusCode, buf: Buffer.concat(chunks) }));
    }); req.end();
  });
  console.log('template download:', tpl.s, 'bytes:', tpl.buf.length);

  // modify template: read, fill a couple rows in 扫盘数据 sheet
  const wb = XLSX.read(tpl.buf, { type: 'buffer' });
  const ws = wb.Sheets['扫盘数据'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // rows[0] = header. Fill rows 1,2 (samples) with real data, clear row 3+4 placeholders
  rows[1] = ['英超', '曼联', '利物浦', '2026-09-20 19:30', '周日', '101', '4', '免费', '主胜', '主-0.5 胜', '2:1', '2球', '胜/胜', ''];
  rows[2] = ['西甲', '皇马', '巴萨', '2026-09-21 22:00', '周一', '102', '5', '月度', '平', '客+0.5 胜', '1:1', '3球', '平/平', '红'];
  const ws2 = XLSX.utils.aoa_to_sheet(rows);
  wb.Sheets['扫盘数据'] = ws2;
  const outPath = path.join(__dirname, '_upload_test.xlsx');
  XLSX.writeFile(wb, outPath);
  const content = fs.readFileSync(outPath);
  fs.unlinkSync(outPath);

  // 3. upload with auto-publish
  const formBuf = buildMultipart({ publish: '1' }, { name: 'sweep_test.xlsx', content });
  const up = await call('POST', '/api/admin/upload/sweep', formBuf, tok, true);
  console.log('UPLOAD (auto-publish):', up.s, up.b);

  // 4. verify via public sweep list
  const pub = await call('GET', '/api/sweep?limit=5', null, null, false);
  const pj = JSON.parse(pub.b);
  const found = pj.records.filter(r => r.home_team === '曼联' || r.home_team === '皇马');
  console.log('public sweep total:', pj.total, '| found uploaded:', found.length);
  found.forEach(r => console.log('  ', r.league, r.home_team + ' vs ' + r.away_team, '| status=' + r.status, '| wd=' + r.weekday, '| no=' + r.match_no));

  console.log('DONE'); process.exit(0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
