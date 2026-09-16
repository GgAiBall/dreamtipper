# 竞彩官网中转服务（sporttery-relay）

竞彩官网（webapi.sporttery.cn）对境外/部分 IP 做了封禁，导致部署在 Render（新加坡）的 dreamtipper
后端点「获取结果」时连不上官网。此中转服务部署在**能访问竞彩官网的节点**（国内服务器 / 腾讯云函数等），
dreamtipper 把所有竞彩请求改经它转发，从而恢复自动获取比分 + 红/黑判定。

> 安全：仅允许转发到 `webapi.sporttery.cn / m.sporttery.cn / i.sporttery.cn / static.sporttery.cn`，
> 不会被当成开放代理滥用。

## 调用约定
```
GET /?url=<encodeURIComponent(竞彩官网完整地址)>
```
返回上游原始响应（含 CORS `*`）。dreamtipper 端 `resultSource.js` 的 `resolveUrl()` 已自动拼这个地址。

## 部署方式一：独立 Node 服务（任意国内服务器 / VPS）
```bash
cd sporttery-relay
node server.js          # 监听 PORT 或 3000
# 建议用 pm2 / systemd 守护；用 nginx/caddy 反代并配 HTTPS 域名
```
部署后拿到公网地址，例如 `https://relay.your-domain.com`。

## 部署方式二：腾讯云函数计算 SCF（无需 VPS，国内地域）
1. 新建函数 → 运行环境 Nodejs 16+ → 上传 `scf.js` 内容（保存为 `index.js`），
   执行方法填 `index.main_handler`，地域选**广州/上海/北京**等国内地域。
2. 触发管理 → 新建 API 网关服务（HTTP 触发），得到公网地址
   （如 `https://service-xxxx.ap-guangzhou.apigw.tencentcs.com/release/`）。
3. 如需自定义域名可在 API 网关绑定。

## 接入 dreamtipper（Render 控制台）
在 Render → dreamtipper 服务 → Environment 添加环境变量：
```
RESULT_PROXY_URL = https://你的中转地址
```
（render.yaml 已预留该变量，sync:false，可直接在控制台填。）
保存后 Render 会自动重新部署。之后后台「🔄 获取结果 / 批量获取官网结果」即走中转拉取真实比分。

## 自检
部署后本地验证中转是否通：
```bash
curl "https://你的中转地址/?url=https%3A%2F%2Fwebapi.sporttery.cn%2Fgateway%2Funiform%2Ffb%2FgetMatchLiveV1.qry%3FmatchIds%3D%26eventTc%3Dgoals%2Cpenalty_shootout%26method%3Dlive"
```
正常应返回 JSON（含 `value` 数组、各场 `sectionsNo999` 全场比分）。
