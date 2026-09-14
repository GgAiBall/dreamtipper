# 梦幻竞彩家 - 体育数据分析平台

## 🚀 快速启动

### 方式一：一键启动（推荐）
```powershell
cd dreamtipper
npm run dev
```
同时启动后端（端口3001）和前端（端口5173）

### 方式二：分别启动
```powershell
# 终端1 - 后端
cd dreamtipper/server
npm start

# 终端2 - 前端
cd dreamtipper/client
npm run dev
```

## 🔑 默认账户

| 角色 | 邮箱 | 密码 |
|------|------|------|
| 管理员 | admin@dreamtipper.com | admin123 |

## 📂 功能说明

### 前台（会员端）
- `/` 首页 - 数据总览、今日扫盘预览、战绩统计
- `/data` 扫盘数据 - 按日期/联赛筛选，支持权限分层
- `/plans` 方案市场 - 查看订阅方案、解锁单次方案
- `/plans/:id` 方案详情 - 历史战绩、推荐记录、胜率走势图
- `/stats` 战绩统计 - 胜率曲线、信心星级分析、联赛分布
- `/dashboard` 会员中心 - 个人订阅、购买记录
- `/profile` 个人设置

### 后台（管理员端）
- `/admin` 总览 - 用户数、收入、今日战绩、待发布数量
- `/admin/upload` 扫盘数据 - 手动录入 / 文件导入 / 草稿 → 发布 / 单条修改（记录变更时间）
- `/admin/plans-upload` 推荐方案 - 手动录入 / 批量导入 / 草稿 → 发布 / 修改 / 撤回
- `/admin/members` 会员管理 - 查看所有注册用户
- `/admin/plans` 方案定义 - 添加/编辑/上线/下线付费方案

## 📊 数据格式

### CSV/JSON 导入格式
```
league,home_team,away_team,match_time,handicap,odds,odds_type,confidence_stars,tier_required,result
英超,曼城,阿森纳,2024-09-15T21:00:00,-0.5,1.95,胜平负,5,monthly,win
```

### JSON 格式
```json
[
  {
    "league": "英超",
    "home_team": "曼城",
    "away_team": "阿森纳",
    "match_time": "2024-09-15T21:00:00",
    "handicap": "-0.5",
    "odds": 1.95,
    "odds_type": "胜平负",
    "confidence_stars": 5,
    "tier_required": "monthly",
    "result": "win"
  }
]
```

## 💡 权限体系

| 等级 | 价格 | 查看权限 |
|------|------|----------|
| 免费 | 0元 | 免费扫盘数据 |
| 月度会员 | 199元/月 | 月度精选方案 + 完整统计 |
| 年度会员 | 999元/年 | 全部方案 + 实时推荐 |

## 🛠 技术栈

- **前端**: Vue 3 + Vite + Pinia + ECharts + Vue Router
- **后端**: Node.js + Express + JWT + sql.js (WebAssembly)
- **数据库**: sql.js (SQLite in-memory，持久化为 dreamtipper.db)

## ⚠️ 注意事项

1. 每次修改服务器代码后需重启后端
2. 数据文件存储在 `server/dreamtipper.db`
3. 上传文件存储在 `server/uploads/`
4. 支付接口目前为模拟实现，需接入真实支付渠道
