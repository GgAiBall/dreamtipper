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
    const totalParams = [];
    if (date) { sql += ` AND date(created_at) = ?`; params.push(date); totalParams.push(date); }
    if (league) { sql += ` AND league LIKE ?`; params.push(`%${league}%`); totalParams.push(`%${league}%`); }
    if (weekday) { sql += ` AND weekday = ?`; params.push(parseInt(weekday)); totalParams.push(parseInt(weekday)); }
    sql += ` ORDER BY match_time DESC`;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const rows = await queryAll(sql, params);
    let totalSql = `SELECT COUNT(*) as c FROM sweep_records WHERE status != 'pending'`;
    if (date) totalSql += ` AND date(created_at) = ?`;
    if (league) totalSql += ` AND league LIKE ?`;
    if (weekday) totalSql += ` AND weekday = ?`;
    const totalObj = await queryOne(totalSql, totalParams);
    const total = totalObj?.c || 0;

    // 查询当前用户已解锁的扫盘 ID 列表
    let unlockedIds = [];
    if (userTier === 'free' && authHeader) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'dreamtipper-secret-key-2024');
        const unlocked = await queryAll('SELECT sweep_id FROM user_unlocks WHERE user_id = ?', [decoded.id]);
        unlockedIds = unlocked.map(u => u.sweep_id);
      } catch (e) {}
    }

    const userLevel = tierLevel(userTier);
    const filtered = rows.map(r => {
      const reqLevel = tierLevel(r.tier_required);
      // 免费用户已解锁过的场次依然返回完整数据
      if (reqLevel > userLevel && !unlockedIds.includes(r.id)) {
        return { ...r, odds: null, handicap: null, confidence_stars: null, result: null };
      }
      return r;
    });

    res.json({ records: filtered, total, page: parseInt(page), limit: parseInt(limit), unlockedIds });
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
