# 竞彩详情批量缓存刷入 Turso（B 路线完成）— 2026-09-19

## 执行结果
- 竞彩列表拉取：57 场（含今晚/明天的英超/西甲/意甲/德甲等）
- 匹配 published 记录：99 条通过「主队|客队」精确匹配到竞彩 matchId（wbsj_match_id）
- 写入 Turso：101 条记录（99 新关联 + 2 已有）竞彩详情全部刷入 `sporttery_detail_cache` 表

## 关键发现
1. **syncScheduler.js 字段名正确**（`homeTeamAllName`），但生产 DB 队名全空是之前 sync 失败的结果
2. **竞彩详情端点只认 `sportteryMatchId`**（如 2041560），不认 `wbsj_match_id`（matchId）；两者数值不同
3. **本地直连竞彩正常**，竞彩对本地 IP 不 geo-block
4. **Render 新加坡节点被竞彩 geo-block**（HTTP 567），生产写缓存需本地跑

## 前端 Bug 修复
- API 返回 `{ feature: {直接对象} }`，但模板用 `sporttery.feature.data`（多了一层 `.data`）
- 修复：全局替换移除所有多余的 `.data` 引用（100 chars / 10+ 处）
- commit 49f7a86，已部署

## 验证方式（部署完成后）
1. 打开 /admin/upload
2. 任意点一条记录 → 「📊 基本信息」
3. 点「特征分析」Tab → 显示 6 维柱状图（近10场/同主客/交锋/场均进失球）
4. 点「历史交锋」Tab → 显示历史对战表格
5. 点「积分榜」Tab → 显示主客队积分榜

## 待办（未完成）
- 今日剩余 64 条无匹配记录（队名差异，如"谢菲联"vs"谢菲尔德联"）可用模糊匹配补全
- 竞彩详情 1 小时缓存过期后需刷新（可设 cron 每天 22:00 重新拉取）
