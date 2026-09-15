# 部署说明（Render + Turso 云数据库）

## 架构

```
浏览器 ──HTTPS──> Render Web Service (dreamtipper-api, 新加坡, Free)
                        │  Express (server/index.js)
                        │  @libsql/client
                        ▼
                  Turso 云数据库 (libSQL / SQLite 兼容, 免费额度)
```

- 前端：Vue3 构建产物 `client/dist` 直接提交进仓库，由 Express 托管（同源，无跨域）。
- 后端：Express + `@libsql/client`。
- 数据库：**Turso**（远程持久化，不受 Render 免费实例重启影响）。

> 历史方案 `sql.js`（本地文件库）已废弃：Render 免费实例的磁盘是临时的，
> 每次冷启动/重部署都会把数据库重置并重新生成随机示例数据（实测多次丢数据）。

## 一、创建 Turso 数据库

### 方式 A：网页控制台（推荐，最简单）
1. 打开 https://turso.tech 用 GitHub / Google 注册登录。
2. `Create Database`：名字填 `dreamtipper`，地区选离你最近的（如 `Tokyo` / `Singapore`）。
3. 进入数据库页面，复制 **Database URL**（形如 `libsql://dreamtipper-xxxx.turso.io`）。
4. 点 **Create Token**（或 `Tokens` 页），生成一个 **Auth Token** 并复制。

### 方式 B：CLI
```bash
# 安装：https://docs.turso.tech/cli/installation
turso auth signup                     # 或 turso auth login
turso db create dreamtipper --location sin
turso db show dreamtipper --url       # -> libsql://...
turso db tokens create dreamtipper    # -> eyJ...
```

## 二、在 Render 填入环境变量

Render 控制台 → 服务 `dreamtipper-api` → **Environment** → 添加：

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://dreamtipper-xxxx.turso.io` |
| `TURSO_AUTH_TOKEN` | （上一步复制的 token） |
| `JWT_SECRET` | 随机长字符串（必改，别再用默认值） |

保存后 Render 会自动重新部署。

## 三、导入既有数据（可选）

把已有的数据快照灌入 Turso（幂等，可重复执行）：

```powershell
cd server
$env:TURSO_DATABASE_URL="libsql://dreamtipper-xxxx.turso.io"
$env:TURSO_AUTH_TOKEN="eyJ..."
node migrate.js ..\backups\full_export.json
```

不设这两个 env 时，脚本会写入本地文件库 `server/dreamtipper.db`（本地测试用）。

## 四、日常部署

- 代码推送到 `main` → GitHub Action 触发 Render Deploy Hook → 自动部署。
- 手动触发：`curl -X POST "<Render Deploy Hook URL>"`。

## 五、健康检查与验证

- `GET /api/health` → `{"status":"ok"}`
- 部署后验证数据持久化：任意新增一条草稿 → 在 Render 控制台 `Manual Deploy` 重启一次 → 再查该记录是否还在。

## 备注

- `server/.env.example` 列出了全部环境变量含义；`server/.env` 仅本地使用且不入库。
- 备份快照存放于 `backups/`（已在 `.gitignore` 中排除，因仓库为 Public）。
