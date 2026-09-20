// dedupSweep.js —— 扫盘去重维护工具
// 规则：
//   同一场比赛 = 同一周几 + 同主客队（队名容错：去空白、去音译衬字「尔」）
//   保留优先级：我发布的(published) > 我上传的(admin_upload) > 自动同步(auto_sync)；同级取最新(updated_at/created_at)
//   其余重复删除
//
// 用法（先备份！）：
//   node dedupSweep.js                 → 预演（不删除）
//   node dedupSweep.js --apply         → 执行删除
// 需要环境变量：TURSO_DATABASE_URL / TURSO_AUTH_TOKEN（远端），或本机 dreamtipper.db（本地）
var fs = require('fs');
var path = require('path');
var APPLY = process.argv.includes('--apply');
function norm(s) { return String(s == null ? '' : s).trim(); }
function teamKey(s) { return norm(s).replace(/\s+/g, '').replace(/尔/g, ''); }
function prio(o) {
  if (o.status === 'published') return 3;
  if (o.data_source === 'admin_upload') return 2;
  if (o.data_source === 'auto_sync') return 1;
  return 0;
}
async function getDb() {
  var url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (url) {
    var client = require('@libsql/client');
    var c = client.createClient({ url: url, authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN });
    return { type: 'turso', client: c };
  }
  var initSqlJs = require('sql.js');
  var SQL = await initSqlJs();
  var DB_PATH = path.join(__dirname, 'dreamtipper.db');
  var buf = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
  var d = buf ? new SQL.Database(buf) : new SQL.Database();
  return { type: 'local', db: d };
}
(async function() {
  var h = await getDb();
  var rows;
  if (h.type === 'turso') {
    var r = await h.client.execute("SELECT id, weekday, match_no, home_team, away_team, status, data_source, created_at, updated_at FROM sweep_records WHERE weekday IS NOT NULL AND match_no IS NOT NULL AND match_no != ''");
    var cols = r.columns;
    rows = r.rows.map(function(row) { var o = {}; cols.forEach(function(c, i) { o[c] = row[i]; }); return o; });
  } else {
    var res = h.db.exec("SELECT id, weekday, match_no, home_team, away_team, status, data_source, created_at, updated_at FROM sweep_records WHERE weekday IS NOT NULL AND match_no IS NOT NULL AND match_no != ''");
    rows = [];
    if (res.length) res[0].values.forEach(function(v) {
      rows.push({ id: v[0], weekday: v[1], match_no: v[2], home_team: v[3], away_team: v[4], status: v[5], data_source: v[6], created_at: v[7], updated_at: v[8] });
    });
  }

  var groups = {};
  rows.forEach(function(o) {
    var key = norm(o.weekday) + '|' + teamKey(o.home_team) + '|' + teamKey(o.away_team);
    (groups[key] = groups[key] || []).push(o);
  });

  var toDelete = [];
  var groupsAffected = 0;
  Object.keys(groups).forEach(function(key) {
    var g = groups[key];
    if (g.length < 2) return;
    groupsAffected++;
    g.sort(function(a, b) {
      var ap = prio(a), bp = prio(b);
      if (ap !== bp) return bp - ap;
      var at = new Date(a.updated_at || a.created_at || 0).getTime();
      var bt = new Date(b.updated_at || b.created_at || 0).getTime();
      if (at !== bt) return bt - at;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    var keep = g[0];
    console.log('\n[重复] 周' + keep.weekday + ' ' + keep.match_no + ' | ' + keep.home_team + ' vs ' + keep.away_team + ' (' + g.length + '条)');
    console.log('   保留:', keep.status, '|', keep.data_source, '| created', keep.created_at);
    g.slice(1).forEach(function(d) {
      console.log('   删除:', d.status, '|', d.data_source, '| created', d.created_at, '| id', String(d.id).slice(0, 24));
      toDelete.push(d.id);
    });
  });

  console.log('\n===== 汇总 =====');
  console.log('重复组数:', groupsAffected, '| 将删除:', toDelete.length, '条 | 删除后剩余:', rows.length - toDelete.length, '条');

  if (!APPLY) { console.log('（预演模式，未删除。加 --apply 执行）'); return; }

  var done = 0, failed = 0;
  for (var i = 0; i < toDelete.length; i++) {
    try {
      if (h.type === 'turso') await h.client.execute({ sql: "DELETE FROM sweep_records WHERE id = ?", args: [toDelete[i]] });
      else h.db.run("DELETE FROM sweep_records WHERE id = ?", [toDelete[i]]);
      done++;
    } catch (e) { failed++; console.log('删除失败:', toDelete[i], e.message); }
  }
  console.log('\n已删除', done, '条，失败', failed, '条');
})().catch(function(e) { console.log('ERR:', e.message); });
