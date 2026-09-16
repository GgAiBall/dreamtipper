// sporttery-relay/scf.js
// 腾讯云函数计算（SCF）版本。部署到国内地域（如 广州/上海/北京）后即可访问竞彩官网。
// 用法：将此文件作为云函数的 index.js 上传（执行方法填 index.main_handler），
//       通过 API 网关触发，绑定自定义域名（或 API 网关默认域名）。
// dreamtipper 后端配置 RESULT_PROXY_URL=https://你的API网关地址 即可。

const https = require('https');

const ALLOWED_HOSTS = ['webapi.sporttery.cn', 'm.sporttery.cn', 'i.sporttery.cn', 'static.sporttery.cn'];

function get(target) {
  return new Promise((resolve, reject) => {
    let t;
    try { t = new URL(target); } catch (e) { return reject('bad url'); }
    if (!ALLOWED_HOSTS.includes(t.hostname)) return reject('host not allowed');
    const req = https.request({
      method: 'GET', hostname: t.hostname, path: t.pathname + t.search, timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*', 'Referer': 'https://m.sporttery.cn/' },
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, buf: Buffer.concat(c), ct: res.headers['content-type'] || 'application/json' }));
    });
    req.on('error', e => reject('upstream error: ' + e.message));
    req.on('timeout', () => { req.destroy(); reject('timeout'); });
    req.end();
  });
}

exports.main_handler = async (event) => {
  const qs = (event && event.queryString) || {};
  const target = qs.url;
  if (!target) return { statusCode: 400, headers: { 'Content-Type': 'text/plain' }, body: 'missing url param' };
  try {
    const r = await get(target);
    return {
      statusCode: r.status,
      headers: { 'Content-Type': r.ct, 'Access-Control-Allow-Origin': '*' },
      // 竞彩中文为 GBK，转 UTF-8 后中文会变乱码，但本服务只需 matchNum(数字)/sectionsNo999(数字比分) 等 ASCII 字段，
      // JSON 仍可被下游正常解析，故直接用 UTF-8 字符串返回，避免依赖 API 网关的 base64 解码配置。
      body: r.buf.toString('utf8'),
    };
  } catch (e) {
    return { statusCode: 502, headers: { 'Content-Type': 'text/plain' }, body: 'err: ' + e };
  }
};
