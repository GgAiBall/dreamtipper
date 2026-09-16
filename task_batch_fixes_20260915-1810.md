# 梦幻竞彩家 — 批量修复任务记录（2026-09-15 17:23-18:18 GMT+8）

## 一、会员方案「改价后无法上架」Bug（核心修复）
**根因**：AdminPlans.vue 表单无 is_active 字段、无上下架按钮 → 新建/编辑永远不发送 is_active → 后端 `is_active ? 1 : 0` 收到 undefined → 0 → 永远「已下线」。
**修复**：
- `client/src/views/AdminPlans.vue`：form 增加 `is_active`（默认1）；编辑时回填 `is_active: p.is_active ? 1 : 0`；savePlan 发送 `is_active`；新增「上架/下架」切换按钮（调 PUT /admin/plans/:id）；表单加「立即上架公开」勾选。
- 后端 `PUT /plans/:id`（admin.js 393）早已支持 is_active 字段，前端补发即修复。

## 二、删除所有测试数据
- 经 Turso 直连（`_cleanup2.js`）：删 88 条 `sweep-` 前缀示例数据 + 2 条 DEBUG/TEST 垃圾。
- 最终保留 **16 条真实人工数据**（UUID，全部 2026-09-15，category=人工扫盘）。
- daily_stats 仅剩 2026-09-15 一行（total=16, wins/losses/pushes=0, win_rate=0%）。

## 三、统计数据从今天（09-15）开始
- 删除旧 daily_stats 后，统计起点即 09-15。已验证 `daily_stats` 仅 1 行 2026-09-15。

## 四、会员专享详情页链接（设计预留）
- `sweep_records` 加 `detail_url` / `category` / `data_source` 三列（db.js ALTER + Turso 直连已加）。
- 前端 Data.vue：免费用户看 🔒 详情；月/年会员显示可点的 📋 详情链接（`api.get('/api/sweep')` 返回 `unlockedIds`，已解锁场次不外显锁定）。
- 后端 `GET /api/sweep` 已返回 `detail_url`、`category`。

## 五、扫盘数据分类（人工/AI/大神）
- category 字段贯穿：手动新增表单、编辑弹窗、Excel 批量上传（sweepParser.js 表头别名「分类/类型/来源」）、模板下载（新增「分类」「详情页链接」两列）、admin 列表标签色（人工=蓝/AI=紫/大神=金）。
- 默认「人工扫盘」；AI/大神为后续 pai 接入 AI 分析接口预留。
- 今日（09-15）上传数据已标记人工扫盘。

## 六、排序按每日编号（001 在最上）
- `server/routes/sweep.js`：`ORDER BY match_time DESC` → `ORDER BY CAST(match_no AS INTEGER) ASC, weekday ASC`。
- 生产验证：返回 order = 001,002,...,012 ✅。

## 七、分页修复（点击下一页仍是默认页）
- Data.vue 分页按钮 `page--/page++` **未触发 loadData** → 改为 `page>1 && (page--, loadData())` / `page<max && (page++, loadData())`。
- 所有筛选变更（联赛/周几/日期/清除）重置 `page=1`。

## 八、SKIP_SAMPLE_SEED
- render.yaml 加 `SKIP_SAMPLE_SEED: 'true'`，禁止部署后再次塞入示例数据。

## 部署
- commit `c3ac7fc`，push `dabd319..c3ac7fc`，Render Deploy Hook 202。
- 生产验证：health 200；/api/sweep 排序正确、total 14（已发布）、category=人工扫盘；模板下载 200/21140B。

## 遗留待办
- 默认管理员 admin@dreamtipper.com/admin123、JWT_SECRET 默认值未改。
- 真实数据命中率仍为 0%（比赛未结算）。
- AI 分析接口（pai）待后续接入。
- 客户端暂无会员账号实测（解锁链路前轮已 E2E 通过）。
