const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');

router.get('/overview', async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const totals = await queryOne(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes,
        SUM(CASE WHEN result = 'win' THEN 1 WHEN result = 'loss' THEN -1 ELSE 0 END) as net,
        ROUND(AVG(CASE WHEN result != 'pending' THEN 
          CASE WHEN result = 'win' THEN 1 WHEN result = 'push' THEN 0.5 ELSE 0 END 
        END) * 100, 1) as win_rate
      FROM recommendations
      WHERE result != 'pending'
    `) || { total: 0, wins: 0, losses: 0, pushes: 0, net: 0, win_rate: 0 };

    const dailyStats = (await queryAll(`SELECT * FROM daily_stats ORDER BY date DESC LIMIT ?`, [parseInt(days)])).reverse();

    const leagueStats = await queryAll(`
      SELECT league, COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        ROUND(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result IN ('win','loss') THEN 1 ELSE 0 END), 0), 1) as win_rate
      FROM sweep_records WHERE status = 'settled' GROUP BY league ORDER BY total DESC LIMIT 15
    `);

    const starStats = await queryAll(`
      SELECT confidence_stars, COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        ROUND(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result IN ('win','loss') THEN 1 ELSE 0 END), 0), 1) as win_rate
      FROM sweep_records WHERE status = 'settled' GROUP BY confidence_stars ORDER BY confidence_stars DESC
    `);

    const recent7 = await queryOne(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        ROUND(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result IN ('win','loss') THEN 1 ELSE 0 END), 0), 1) as win_rate
      FROM recommendations WHERE result != 'pending' AND published_at >= datetime('now', '-7 days')
    `) || { total: 0, wins: 0, losses: 0, win_rate: 0 };

    const recent30 = await queryOne(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        ROUND(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result IN ('win','loss') THEN 1 ELSE 0 END), 0), 1) as win_rate
      FROM recommendations WHERE result != 'pending' AND published_at >= datetime('now', '-30 days')
    `) || { total: 0, wins: 0, losses: 0, win_rate: 0 };

    const currentStreak = await queryAll(`SELECT result FROM recommendations WHERE result != 'pending' ORDER BY published_at DESC LIMIT 20`);
    let winStreak = 0, lossStreak = 0;
    for (const r of currentStreak) {
      if (r.result === 'win') winStreak++;
      else if (r.result === 'loss') { lossStreak++; break; }
      else break;
    }

    res.json({
      totals,
      dailyStats: dailyStats.reverse(),
      leagueStats,
      starStats,
      comparison: { recent7, recent30 },
      streak: { win: winStreak, loss: lossStreak, streakType: winStreak > 0 ? 'win' : 'loss' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/plans/:id', async (req, res) => {
  try {
    const plan = await queryOne('SELECT * FROM plans WHERE id = ?', [req.params.id]);
    if (!plan) return res.status(404).json({ error: '方案不存在' });

    const stats = await queryOne(`
      SELECT COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN result = 'push' THEN 1 ELSE 0 END) as pushes,
        ROUND(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN result IN ('win','loss') THEN 1 ELSE 0 END), 0), 1) as win_rate,
        ROUND(SUM(profit), 2) as total_profit
      FROM recommendations WHERE plan_id = ? AND result != 'pending'
    `, [req.params.id]) || { total: 0, wins: 0, losses: 0, pushes: 0, win_rate: 0, total_profit: 0 };

    const recent = (await queryAll(`
      SELECT r.*, s.home_team, s.away_team, s.league, s.match_time
      FROM recommendations r LEFT JOIN sweep_records s ON r.sweep_record_id = s.id
      WHERE r.plan_id = ? AND r.result != 'pending' ORDER BY r.published_at DESC LIMIT 50
    `, [req.params.id])).reverse();

    const daily = (await queryAll(`
      SELECT date(published_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END) as losses,
        ROUND(SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as win_rate
      FROM recommendations WHERE plan_id = ? AND result != 'pending' GROUP BY date(published_at) ORDER BY date DESC LIMIT 30
    `, [req.params.id])).reverse();

    res.json({ plan: { ...plan, stats: JSON.parse(plan.stats || '{}') }, stats, recent, daily });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
