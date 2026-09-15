const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../db');
const auth = require('../middleware/auth');

// ── 每日解锁次数查询 ───────────────────────────────────────
router.get('/unlocks-left', auth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const row = await queryOne('SELECT COALESCE(SUM(unlocks_used),0) as c FROM user_daily_unlocks WHERE user_id = ? AND unlock_date = ?',
      [req.user.id, today]);
    const used = Number(row?.c || 0);
    res.json({ left: Math.max(0, 3 - used), used, daily_limit: 3 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── 解锁单条扫盘记录（免费用户每日3次）─────────────────────
router.post('/unlock/:sweepId', auth, async (req, res) => {
  try {
    const user = await queryOne('SELECT subscription_tier FROM users WHERE id = ?', [req.user.id]);
    if (user?.subscription_tier !== 'free') {
      return res.json({ success: true, message: '会员无需解锁', unlocksLeft: 999 });
    }
    // 检查今日已用次数
    const today = new Date().toISOString().split('T')[0];
    const row = await queryOne('SELECT COALESCE(SUM(unlocks_used),0) as c FROM user_daily_unlocks WHERE user_id = ? AND unlock_date = ?',
      [req.user.id, today]);
    const used = Number(row?.c || 0);
    if (used >= 3) return res.status(403).json({ error: '今日解锁次数已用完（每日免费3次）' });
    // 记录解锁
    await run(`INSERT INTO user_daily_unlocks (id, user_id, unlock_date, unlocks_used) VALUES (?, ?, ?, 1)
      ON CONFLICT(user_id, unlock_date) DO UPDATE SET unlocks_used = unlocks_used + 1`,
      [uuidv4(), req.user.id, today]);
    // 返回剩余次数
    const newUsed = used + 1;
    res.json({ success: true, unlocksLeft: Math.max(0, 3 - newUsed), used: newUsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
