const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../db');
const auth = require('../middleware/auth');

router.get('/me', auth, async (req, res) => {
  try {
    const purchases = await queryAll(`
      SELECT p.*, pl.name as plan_name, pl.price as plan_price
      FROM user_purchases p
      LEFT JOIN plans pl ON p.plan_id = pl.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json({ purchases });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/subscribe', auth, async (req, res) => {
  try {
    const { tier } = req.body;
    const prices = { monthly: 19900, yearly: 99900 };
    if (!prices[tier]) return res.status(400).json({ error: '无效的订阅方案' });

    const purchaseId = uuidv4();
    const expireAt = tier === 'yearly'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await run(`INSERT INTO user_purchases (id, user_id, type, amount, status, paid_at, expire_at) VALUES (?, ?, 'subscription', ?, 'paid', datetime('now'), ?)`,
      [purchaseId, req.user.id, prices[tier], expireAt]);

    await run(`UPDATE users SET subscription_tier = ?, subscription_expire = ? WHERE id = ?`,
      [tier, expireAt, req.user.id]);

    const user = await queryOne('SELECT id, email, nickname, role, subscription_tier, subscription_expire FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
