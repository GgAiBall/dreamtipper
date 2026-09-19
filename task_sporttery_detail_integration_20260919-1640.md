# 竞彩官网详情数据接入（特征分析/历史交锋/积分榜/未来赛事/伤停）— 2026-09-19

## 关键发现
1. **竞彩详情 6 端点全部可用**（从 static.sporttery.cn 抓 zqbsComponent.js 解析）：
   - getMatchFeatureV1.qry — 特征分析 6 维（近10场/同主客/主客交锋/同主客交锋 + 场均进失球）
   - getResultHistoryV1.qry — 历史交锋（matchList + 胜平负统计）
   - getMatchTablesV2.qry — 积分榜（总/主/客）
   - getMatchResultV1.qry — 已结算比分
   - getFutureMatchesV1.qry — 未来赛事
   - getInjurySuspensionV1.qry — 伤停
2. **致命限制**：所有端点只认 `sportteryMatchId`（如 67452），但 `getMatchListV1`（sync 用的列表接口）**完全不返回**该字段，只返回 `wbsj_match_id`（如 2041556）。wbsj_match_id 调详情端点返回空。
3. **geo-block**：Render 新加坡节点调竞彩返回 HTTP 567（被地理封锁），本地中国 IP 正常。

## 最终方案
- `server/sportteryDetail.js`：封装 6 端点，`getJson` 支持 `RESULT_PROXY_URL` 中转（与 resultSource.js 一致）。
- `server/routes/admin.js` 新增：
  - `GET /admin/sweep/:id/sporttery-context?type=feature|h2h|tables|future|injury|all`
  - `PUT /admin/sweep/:id/sporttery-id`（手动填竞彩 mid）
  - **DB 缓存**：`sporttery_detail_cache` 表，1 小时内有效，生产读缓存避开 geo-block。
- `server/db.js`：sweep_records 加 `sporttery_match_id/wbsj_match_id/home_team_id/away_team_id/league_id/tournament_id/season_id` 7 列；加 `sporttery_detail_cache` 表。
- `server/syncScheduler.js`：同步时存全部 ID（wbsj_match_id/home_team_id/away_team_id/league_id）。
- `client/src/views/AdminUpload.vue`：
  - 列表加「🔗 竞彩详情」按钮（用 sporttery_match_id 或 wbsj_match_id 打开 URL）
  - 基本信息弹窗加 5 个 Tab：赔率 / 特征分析（6维 bar）/ 历史交锋 / 积分榜 / 未来赛事 / AI提示词
  - 加 `featureList()` helper 渲染特征分析

## 使用方式（管理员）
1. 打开 https://www.sporttery.cn/jc/zqdz/index.html?showType=2 找到比赛详情页，复制 URL 里的 `mid=XXXX`
2. 在 AdminUpload 编辑记录，填「竞彩 mid」字段（前端表单已支持，PUT 端点已加）
3. 基本信息弹窗自动拉取竞彩特征分析/历史交锋/积分榜/未来赛事
4. 「🔗 竞彩详情」按钮一键跳转官方页

## 局限与后续
- 自动 sync 拿不到 sportteryMatchId → 需手动填（或后续找返回 sportteryMatchId 的列表接口）
- 生产被 geo-block → 需部署 RESULT_PROXY_URL 中继（sporttery-relay/ 已就绪，待国内节点）；或本地（中国IP）跑缓存刷新脚本把数据写入 Turso
- commit af3019c，已部署
