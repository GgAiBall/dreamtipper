/**
 * 数据迁移脚本：把本地导出的 JSON 快照灌入当前数据库（Turso 远端 或 本地文件）。
 *
 * 用法：
 *   PowerShell:
 *     $env:TURSO_DATABASE_URL="libsql://xxx.turso.io"; $env:TURSO_AUTH_TOKEN="eyJ..."; node migrate.js ..\backups\full_export.json
 *   本地文件:
 *     node migrate.js ..\backups\full_export.json      （不设 env 时自动用 file:./dreamtipper.db）
 *
 * 幂等：使用 INSERT OR REPLACE，重复执行安全。
 */
const fs = require('fs');
const path = require('path');
const { initDb, queryOne } = require('./db');
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || '';
const url = TURSO_URL || `file:${path.join(__dirname, 'dreamtipper.db')}`;
const db = createClient({ url, authToken: TURSO_TOKEN || undefined });

const file = process.argv[2];
if (!file) { console.error('用法: node migrate.js <export.json>'); process.exit(1); }
const payload = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
const D = payload.data || payload;

const TABLES = {
  plans: ['id', 'name', 'description', 'price', 'tier_required', 'stats', 'subscriber_count', 'is_active', 'created_at', 'updated_at'],
  sweep_records: ['id', 'match_id', 'league', 'home_team', 'away_team', 'match_time', 'handicap', 'odds', 'odds_type', 'confidence_stars', 'tier_required', 'result', 'status', 'uploaded_by', 'published_at', 'created_at', 'updated_at'],
  recommendations: ['id', 'plan_id', 'sweep_record_id', 'title', 'content', 'published_at', 'result', 'profit', 'created_at', 'updated_at'],
  daily_stats: ['id', 'date', 'total_recommendations', 'wins', 'losses', 'pushes', 'win_rate', 'profit_rate', 'created_at']
};

function coerce(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') {
    if (Buffer.isBuffer(v)) return v;
    return JSON.stringify(v);
  }
  return v;
}

function rowsFor(name) {
  if (name === 'plans') return D.plans || [];
  if (name === 'daily_stats') return D.daily_stats || [];
  return D[name] || [];
}

(async () => {
  console.log('目标数据库:', TURSO_URL ? TURSO_URL.replace(/\/+$/, '') : url);
  process.env.SKIP_SAMPLE_SEED = 'true';
  await initDb(); // 建表 + 管理员 + 默认方案（不播种示例数据）

  for (const [table, cols] of Object.entries(TABLES)) {
    const rows = rowsFor(table);
    if (!rows.length) { console.log(`- ${table}: 0 条（跳过）`); continue; }
    let n = 0;
    for (const r of rows) {
      const args = cols.map((c) => coerce(r[c]));
      const placeholders = cols.map(() => '?').join(', ');
      await db.execute({
        sql: `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
        args
      });
      n++;
    }
    const c = await queryOne(`SELECT COUNT(*) as c FROM ${table}`);
    console.log(`- ${table}: 写入 ${n} 条，现库中共 ${c.c} 条`);
  }
  console.log('✅ 迁移完成');
  process.exit(0);
})().catch((e) => { console.error('迁移失败:', e.message); process.exit(1); });
