/**
 * 足球数据 API 路由
 * 双源：API-Football + football-data.org
 */
const express = require('express');
const router = express.Router();
const footballApi = require('../footballApi');

/**
 * GET /api/football/match-context
 * 根据主客队名称（或扫盘记录）获取完整基本面
 * Query: home_team, away_team, league, match_time, weekday, match_no
 */
router.get('/match-context', async (req, res) => {
  const { home_team, away_team, league, match_time, weekday, match_no } = req.query;
  if (!home_team || !away_team) {
    return res.status(400).json({ error: '缺少 home_team 或 away_team 参数' });
  }
  try {
    const context = await footballApi.getMatchContext({
      home_team, away_team, league,
      match_time, weekday, match_no
    });
    if (context.error) return res.status(404).json({ error: context.error });
    res.json({ success: true, context });
  } catch (e) {
    console.error('match-context error:', e.message);
    res.status(500).json({ error: '获取足球数据失败: ' + e.message });
  }
});

/**
 * GET /api/football/search-teams
 * 模糊搜索球队（联赛/时间/场次/主客队）
 * Query: q (搜索词), league, season, limit
 */
router.get('/search-teams', async (req, res) => {
  const { q, league, season, limit } = req.query;
  if (!q) return res.status(400).json({ error: '缺少 q 参数' });
  try {
    const results = await footballApi.searchTeams(q, {
      league, season: season ? parseInt(season) : 2024,
      limit: limit ? parseInt(limit) : 20
    });
    res.json({ success: true, results, total: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/football/search-matches
 * 模糊搜索比赛（支持联赛+时间+场次+主客队任意组合）
 * Query: league, date, weekday, match_no, home, away, limit
 */
router.get('/search-matches', async (req, res) => {
  try {
    const { league, date, weekday, match_no, home, away, limit } = req.query;
    const results = await footballApi.searchMatches({
      league, date,
      weekday: weekday ? parseInt(weekday) : null,
      matchNo: match_no,
      home, away,
      limit: limit ? parseInt(limit) : 20
    });
    res.json({ success: true, results, total: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/football/standings
 * 查询积分榜（自动双源）
 * Query: team_id, team_name, league
 */
router.get('/standings', async (req, res) => {
  const { team_id, team_name, league } = req.query;
  if (!team_id && !team_name) return res.status(400).json({ error: '缺少 team_id 或 team_name 参数' });
  try {
    if (team_id) {
      const s = await footballApi.getTeamStandings(parseInt(team_id), league);
      res.json({ success: true, standings: s });
    } else {
      // 先搜索球队
      const teams = await footballApi.searchTeams(team_name, { league, limit: 1 });
      if (!teams.length) return res.status(404).json({ error: '未找到球队: ' + team_name });
      const s = await footballApi.getTeamStandings(teams[0].id, league);
      res.json({ success: true, team: teams[0], standings: s });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
