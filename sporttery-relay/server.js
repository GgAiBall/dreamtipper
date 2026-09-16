// sporttery-relay/server.js
// 极简竞彩官网中转服务（部署在「能访问 webapi.sporttery.cn」的节点，如国内服务器/云函数）。
// dreamtipper 后端配置 RESULT_PROXY_URL=https://本服务地址 后，所有竞彩请求经此转发，
// 绕过 Render(新加坡) 被竞彩官网 IP 封禁的问题。
//
// 运行： node server.js   （监听 PORT 或 3000）
// 调用： GET /?url=<encodeURIComponent(竞彩官网地址)>

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 3000;

// 仅允许转发到竞彩官网域名，杜绝被当成开放代理滥用
const ALLOWED_HOSTS = ['webapi.sporttery.cn', 'm.sporttery.cn', 'i.sporttery.cn', 'static.sporttery.cn'];

function pipe(target, res) {
  let t;
  try { t = new URL(target); } catch (e) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('bad url'); }
  if (!ALLOWED_HOSTS.includes(t.hostname)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('host not allowed'); }
  const lib = t.protocol === 'http:' ? http : https;
  const req = lib.request({
    method: 'GET', hostname: t.hostname, path: t.pathname + t.search, timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*', 'Referer': 'https://m.sporttery.cn/' },
  }, upstream => {
    // 原样透传（竞彩中文为 GBK，必须保留字节，勿转码）
    res.writeHead(upstream.statusCode, {
      'Content-Type': upstream.headers['content-type'] || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    });
    upstream.pipe(res);
  });
  req.on('error', e => { res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('upstream error: ' + e.message); });
  req.on('timeout', () => { req.destroy(); res.writeHead(504, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('timeout'); });
  req.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS' });
    return res.end();
  }
  const q = url.parse(req.url, true).query;
  const target = q.url;
  if (!target) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('missing url param'); }
  pipe(target, res);
});

server.listen(PORT, () => console.log('sporttery relay listening on', PORT));
