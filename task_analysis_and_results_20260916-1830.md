# 梦幻竞彩家 — 三项新需求实现记录（2026-09-16 18:30 GMT+8）

## 任务一：扫盘时间 — 日期自动填充 + 5 分钟时间档
- 手动新增/编辑表单：原 `datetime-local` 拆为「比赛日期」（type=date，默认今天）+「开赛时间」（select，**每 5 分钟一档，共 288 个选项**）。
- 提交时后端自动拼接为 `YYYY-MM-DDTHH:MM:SS`。
- Excel 批量上传同步支持「比赛日期」+「开赛时间」两列（sweepParser.js 自动合并；仍兼容单行「比赛时间」）。
- 下载模板已更新为：比赛日期 / 开赛时间 两列替代原「比赛时间」单列。

## 任务二：自动获取官网结果（按 周一001 编号匹配）→ 红/黑单
- `server/resultSource.js` 新增：
  - `fetchOfficialResult({weekday, matchNo, date, league, home, away})`：依据编号匹配竞彩官网结果。数据源通过环境变量 `OFFICIAL_RESULT_API` 配置（支持占位符 `{weekday}{matchNo}{date}{league}{home}{away}`），未配置返回 null。
  - `computeSweepResult(plays, official)`：逐玩法（胜平负/让球/比分/进球/半全场）比对官方比分，判定每盘 红/黑/走，并汇总整单结果（全红=红单，有黑=黑单，全走=走盘）。
- 后端 admin.js 新增：
  - `POST /admin/sweep/:id/fetch-result`：单条获取并写入 `official_result`、更新玩法结果与整单 result/status=settled。
  - `POST /admin/sweep/batch-fetch-result`：批量获取所有未结算且含 周几+场次 的记录。
- 前端 AdminUpload.vue：
  - 每条记录新增「🔄 获取结果」按钮；操作栏新增「🔄 批量获取官网结果」。
  - 列表展示「🏟 官网 X-Y · ✅/❌」官方比分与判定。
- DB：`sweep_records` 新增 `official_result` 列。
- render.yaml 新增 `OFFICIAL_RESULT_API`（sync:false，需在 Render 控制台填写实际数据源）。

## 任务三：实时分析界面（新界面 + 管理员上传）
- 新增公开路由 `/analysis`（列表）与 `/analysis/:id`（详情）。
- 新增后台 `/admin/analysis`：管理员创建/编辑/删除分析文章（标题、分类、可见权限、封面图 URL、正文）。
- DB：新增 `analysis_posts` 表。
- 后端 `routes/analysis.js`：公开 GET 列表/详情；admin.js 内提供 CRUD。
- 导航：Home 顶部 + 英雄区 + 管理后台均已加入「实时分析」入口。

## 部署
- commit `7d23d7c`，push `c3ac7fc..7d23d7c`，Render Deploy Hook 202。
- 生产验证：health 200；/api/analysis 增删查全通；fetch-result 在未配数据源时正确返回「未获取到官网结果」；模板下载 21371B。

## 待用户提供 / 待办
- **任务二数据源**：当前 `OFFICIAL_RESULT_API` 未配置，故「获取结果」会提示“未配置数据源”。需用户给出竞彩官网结果接口（URL 模板 + 返回字段），接上即可真实拉取并自动判红黑。提供后我可微调 `normalizeOfficial` 的字段映射。
- 默认管理员 admin123、JWT_SECRET 默认值仍未改。
- AI 分析接口（pai）按用户“后续”计划，category 已预留「AI扫盘/大神扫盘」。
