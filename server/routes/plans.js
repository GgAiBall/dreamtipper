const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../db');
const auth = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const plans = await queryAll('SELECT * FROM plans WHERE is_active = 1 ORDER BY price ASC');
    const safePlans = plans.map(p => ({ ...p, stats: JSON.parse(p.stats || '{}') }));
    res.json({ plans: safePlans });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const plan = await queryOne('SELECT * FROM plans WHERE id = ? AND is_active = 1', [req.params.id]);
    if (!plan) return res.status(404).json({ error: '方案不存在' });
    const recommendations = await queryAll(`
      SELECT r.*, s.home_team, s.away_team, s.league, s.match_time, s.handicap, s.odds, s.odds_type, s.confidence_stars
      FROM recommendations r
      LEFT JOIN sweep_records s ON r.sweep_record_id = s.id
      WHERE r.plan_id = ?
      ORDER BY r.published_at DESC
      LIMIT 100
    `, [req.params.id]);
    res.json({ plan: { ...plan, stats: JSON.parse(plan.stats || '{}') }, recommendations });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/unlock', auth, async (req, res) => {
  try {
    const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [req.params.id]);
    if (!plan) return res.status(404).json({ error: '方案不存在' });
    const purchased = await queryOne(`SELECT * FROM user_purchases WHERE user_id = ? AND plan_id = ? AND status = 'paid'`, [req.params.user.id, req.params.id]);
    if (purchased) return res.json({ message: '已解锁', unlocked: true });
    const purchaseId = uuidv4();
    await run(`INSERT INTO user_purchases (id, user_id, plan_id, type, amount, status, paid_at) VALUES (?, ?, ?, 'unlock', ?, 'paid', datetime('now'))`,
      [purchaseId, req.params.user.id, req.params.id, plan.price]);
    await run('UPDATE plans SET subscriber_count = subscriber_count + 1 WHERE id = ?', [req.params.id]);
    res.json({ message: '解锁成功', unlocked: true, purchaseId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
