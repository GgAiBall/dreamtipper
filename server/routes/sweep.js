const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');

function getUserTier(user) {
  if (!user) return 'free';
  if (user.subscription_tier === 'yearly') return 'yearly';
  if (user.subscription_tier === 'monthly') return 'monthly';
  return 'free';
}
function tierLevel(tier) { return { free: 0, monthly: 1, yearly: 2 }[tier] || 0; }

router.get('/', async (req, res) => {
  try {
    const { date, league, page = 1, limit = 50, weekday } = req.query;

    let userTier = 'free';
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'dreamtipper-secret-key-2024');
        const user = await queryOne('SELECT subscription_tier FROM users WHERE id = ?', [decoded.id]);
        if (user) userTier = getUserTier(user);
      } catch (e) {}
    }

    let sql = `SELECT * FROM sweep_records WHERE status != 'pending'`;
    const params = [];
    if (date) { sql += ` AND date(match_time) = ?`; params.push(date); }
    if (league) { sql += ` AND league LIKE ?`; params.push(`%${league}%`); }
    if (weekday) { sql += ` AND weekday = ?`; params.push(parseInt(weekday)); }
    sql += ` ORDER BY match_time DESC`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const rows = await queryAll(sql, params);
    const totalObj = await queryOne(`SELECT COUNT(*) as c FROM sweep_records WHERE status != 'pending'`);
    const total = totalObj?.c || 0;

    const userLevel = tierLevel(userTier);
    const filtered = rows.map(r => {
      const reqLevel = tierLevel(r.tier_required);
      if (reqLevel > userLevel) return { ...r, odds: null, handicap: null, confidence_stars: null, result: null };
      return r;
    });

    res.json({ records: filtered, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const record = await queryOne('SELECT * FROM sweep_records WHERE id = ?', [req.params.id]);
    if (!record) return res.status(404).json({ error: '记录不存在' });
    res.json({ record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
