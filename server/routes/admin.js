const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../db');
const adminAuth = require('../middleware/adminAuth');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, __dirname + '/../uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const totalUsers = (await queryOne('SELECT COUNT(*) as c FROM users WHERE role = ?', ['user']))?.c || 0;
    const totalSweeps = (await queryOne('SELECT COUNT(*) as c FROM sweep_records'))?.c || 0;
    const totalPlans = (await queryOne('SELECT COUNT(*) as c FROM plans'))?.c || 0;
    const totalDrafts = (await queryOne("SELECT COUNT(*) as c FROM sweep_records WHERE status = 'pending'"))?.c || 0;
    const totalRevenue = (await queryOne("SELECT COALESCE(SUM(amount),0) as s FROM user_purchases WHERE status = 'paid'"))?.s || 0;
    const today = new Date().toISOString().split('T')[0];
    const todayStats = await queryOne(`
      SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END),0) as wins,
        COALESCE(SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END),0) as losses
      FROM recommendations WHERE date(published_at) = ?
    `, [today]) || { total: 0, wins: 0, losses: 0 };
    const newUsers7d = (await queryOne("SELECT COUNT(*) as c FROM users WHERE role = 'user' AND created_at >= datetime('now', '-7 days')"))?.c || 0;
    res.json({ totalUsers, totalSweeps, totalPlans, totalDrafts, totalRevenue, todayStats, newUsers7d });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 文件批量导入扫盘数据 -> 默认 status='pending' (草稿)
router.post('/upload/sweep', adminAuth, upload.single('file'), async (req, res) => {
  try {
    const fs = require('fs');
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let records = [];
    if (ext === 'json') {
      records = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));
    } else if (ext === 'csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, idx) => obj[h] = values[idx]);
        records.push(obj);
      }
    }
    let imported = 0;
    for (const r of records) {
      const id = r.id || uuidv4();
      await run(`INSERT OR REPLACE INTO sweep_records (id, match_id, league, home_team, away_team, match_time, handicap, odds, odds_type, confidence_stars, tier_required, result, status, uploaded_by, published_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, r.match_id || id, r.league || '', r.home_team || '', r.away_team || '',
          r.match_time || new Date().toISOString(), r.handicap || '', parseFloat(r.odds) || 0,
          r.odds_type || '胜平负', parseInt(r.confidence_stars) || 3,
          r.tier_required || 'free', r.result || 'pending',
          'pending', req.user.id,
          r.published_at || null]);
      imported++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, imported, message: `已保存 ${imported} 条草稿，可点击单独发布` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 手动新增扫盘 -> 默认 status='pending' (草稿)
router.post('/sweep', adminAuth, async (req, res) => {
  try {
    const data = req.body;
    const id = data.id || uuidv4();
    await run(`INSERT INTO sweep_records (id, match_id, league, home_team, away_team, match_time, handicap, odds, odds_type, confidence_stars, tier_required, result, status, uploaded_by, published_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [id, data.match_id || id, data.league || '', data.home_team || '', data.away_team || '',
        data.match_time || new Date().toISOString(), data.handicap || '', parseFloat(data.odds) || 0,
        data.odds_type || '胜平负', parseInt(data.confidence_stars) || 3,
        data.tier_required || 'free', data.result || 'pending',
        'pending', req.user.id,
        data.published_at || null]);
    res.json({ success: true, id, message: '已保存为草稿' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 更新扫盘记录
router.put('/sweep/:id', adminAuth, async (req, res) => {
  try {
    const data = req.body;
    await run(`UPDATE sweep_records SET
      league = ?, home_team = ?, away_team = ?, match_time = ?, handicap = ?,
      odds = ?, odds_type = ?, confidence_stars = ?, tier_required = ?,
      result = ?, updated_at = datetime('now')
      WHERE id = ?`,
      [data.league || '', data.home_team || '', data.away_team || '',
        data.match_time || new Date().toISOString(), data.handicap || '',
        parseFloat(data.odds) || 0, data.odds_type || '胜平负',
        parseInt(data.confidence_stars) || 3, data.tier_required || 'free',
        data.result || 'pending', req.params.id]);
    res.json({ success: true, message: '已更新，记录变更时间' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 单条发布：将 status 由 pending -> published
router.post('/sweep/:id/publish', adminAuth, async (req, res) => {
  try {
    await run(`UPDATE sweep_records SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [req.params.id]);
    res.json({ success: true, message: '已发布' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 批量发布（按筛选条件）
router.post('/sweep/batch-publish', adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请选择记录' });
    const placeholders = ids.map(() => '?').join(',');
    await run(`UPDATE sweep_records SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id IN (${placeholders})`,
      ids);
    res.json({ success: true, message: `已发布 ${ids.length} 条` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 取消发布（回到草稿）
router.post('/sweep/:id/unpublish', adminAuth, async (req, res) => {
  try {
    await run(`UPDATE sweep_records SET status = 'pending', published_at = NULL, updated_at = datetime('now') WHERE id = ?`,
      [req.params.id]);
    res.json({ success: true, message: '已撤回为草稿' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/sweep/:id', adminAuth, async (req, res) => {
  try {
    await run('DELETE FROM sweep_records WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/sweep', adminAuth, async (req, res) => {
  try {
    const { date, league, page = 1, limit = 50, status } = req.query;
    let sql = `SELECT * FROM sweep_records WHERE 1=1`;
    const params = [];
    if (date) { sql += ` AND date(match_time) = ?`; params.push(date); }
    if (league) { sql += ` AND league LIKE ?`; params.push(`%${league}%`); }
    if (status) { sql += ` AND status = ?`; params.push(status); }
    sql += ` ORDER BY updated_at DESC, match_time DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const records = await queryAll(sql, params);
    const total = (await queryOne('SELECT COUNT(*) as c FROM sweep_records WHERE 1=1' +
      (status ? ' AND status = ?' : ''), status ? [status] : []))?.c || 0;
    res.json({ records, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ========== 方案上传（用户付费解锁的方案）==========
router.post('/upload/plan', adminAuth, upload.single('file'), async (req, res) => {
  try {
    const fs = require('fs');
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const ext = req.file.originalname.split('.').pop().toLowerCase();
    let items = [];
    if (ext === 'json') {
      items = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));
    } else if (ext === 'csv') {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const obj = {};
        headers.forEach((h, idx) => obj[h] = values[idx]);
        items.push(obj);
      }
    }
    let imported = 0;
    for (const it of items) {
      const id = uuidv4();
      const planId = it.plan_id || 'plan-monthly-01';
      await run(`INSERT INTO recommendations (id, plan_id, sweep_record_id, title, content, published_at, result, profit, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [id, planId, it.sweep_record_id || null, it.title || '推荐方案', it.content || '',
          null, it.result || 'pending', parseFloat(it.profit) || 0]);
      imported++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, imported, message: `已保存 ${imported} 条方案草稿` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/recommendation', adminAuth, async (req, res) => {
  try {
    const { plan_id, sweep_record_id, title, content } = req.body;
    const id = uuidv4();
    await run(`INSERT INTO recommendations (id, plan_id, sweep_record_id, title, content, published_at, result, profit, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, 'pending', 0, datetime('now'))`,
      [id, plan_id || null, sweep_record_id || null, title || '', content || '']);
    if (sweep_record_id) await run(`UPDATE sweep_records SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [sweep_record_id]);
    res.json({ success: true, id, message: '方案草稿已保存' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/recommendation/:id', adminAuth, async (req, res) => {
  try {
    const { plan_id, title, content, result } = req.body;
    await run(`UPDATE recommendations SET plan_id = ?, title = ?, content = ?, result = ?, updated_at = datetime('now') WHERE id = ?`,
      [plan_id, title, content, result, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/recommendation/:id/publish', adminAuth, async (req, res) => {
  try {
    await run(`UPDATE recommendations SET published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
      [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/recommendation/:id/settle', adminAuth, async (req, res) => {
  try {
    const { result } = req.body;
    const profit = result === 'win' ? 1 : (result === 'push' ? 0 : -1);
    await run(`UPDATE recommendations SET result = ?, profit = ?, updated_at = datetime('now') WHERE id = ?`,
      [result, profit, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/recommendations', adminAuth, async (req, res) => {
  try {
    const { status, plan_id, page = 1, limit = 50 } = req.query;
    let sql = `SELECT r.*, pl.name as plan_name FROM recommendations r LEFT JOIN plans pl ON r.plan_id = pl.id WHERE 1=1`;
    const params = [];
    if (status === 'published') sql += ` AND r.published_at IS NOT NULL`;
    else if (status === 'pending') sql += ` AND r.published_at IS NULL`;
    if (plan_id) { sql += ` AND r.plan_id = ?`; params.push(plan_id); }
    sql += ` ORDER BY r.updated_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    const items = await queryAll(sql, params);
    res.json({ items, total: items.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/recommendation/:id', adminAuth, async (req, res) => {
  try { await run('DELETE FROM recommendations WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/members', adminAuth, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * 20;
    const users = await queryAll(`
      SELECT id, email, nickname, subscription_tier, subscription_expire, created_at,
        (SELECT COUNT(*) FROM user_purchases WHERE user_id = users.id AND status = 'paid') as purchase_count
      FROM users WHERE role = 'user' ORDER BY created_at DESC LIMIT 20 OFFSET ?
    `, [offset]);
    const total = (await queryOne('SELECT COUNT(*) as c FROM users WHERE role = ?', ['user']))?.c || 0;
    res.json({ users, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/plans', adminAuth, async (req, res) => {
  try {
    const plans = await queryAll('SELECT * FROM plans ORDER BY price ASC');
    const safePlans = plans.map(p => ({ ...p, stats: JSON.parse(p.stats || '{}') }));
    res.json({ plans: safePlans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/plans', adminAuth, async (req, res) => {
  try {
    const { name, description, price, tier_required } = req.body;
    const id = uuidv4();
    await run(`INSERT INTO plans (id, name, description, price, tier_required, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [id, name, description || '', price || 0, tier_required || 'free']);
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/plans/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, price, tier_required, is_active } = req.body;
    await run(`UPDATE plans SET name = ?, description = ?, price = ?, tier_required = ?, is_active = ?, updated_at = datetime('now') WHERE id = ?`,
      [name, description || '', price || 0, tier_required || 'free', is_active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;