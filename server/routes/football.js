/**
 * 足球数据 API 路由
 * /api/football/match-context  — 根据主客队名称获取完整基本面
 */
const express = require('express');
const router = express.Router();
const footballApi = require('../footballApi');

/**
 * GET /api/football/match-context
 * Query: home_team, away_team
 * 返回完整基本面给 AI 分析用
 */
router.get('/match-context', async (req, res) => {
  const { home_team, away_team } = req.query;
  if (!home_team || !away_team) {
    return res.status(400).json({ error: '缺少 home_team 或 away_team 参数' });
  }

  try {
    const context = await footballApi.getMatchContext({ home_team, away_team });
    if (context.error) {
      return res.status(404).json({ error: context.error });
    }
    res.json({ success: true, context });
  } catch (e) {
    console.error('match-context error:', e.message);
    res.status(500).json({ error: '获取足球数据失败: ' + e.message });
  }
});

/**
 * GET /api/football/team-search
 * Query: name, league (optional)
 * 搜索球队，返回 ID+名称+Logo
 */
router.get('/team-search', async (req, res) => {
  const { name, league } = req.query;
  if (!name) return res.status(400).json({ error: '缺少 name 参数' });

  try {
    const team = await footballApi.findTeam(name, league ? parseInt(league) : undefined);
    if (!team) return res.status(404).json({ error: '未找到球队: ' + name });
    res.json({ success: true, team });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/football/standings
 * Query: team_id, league (default 39 英超)
 */
router.get('/standings', async (req, res) => {
  const { team_id, league } = req.query;
  if (!team_id) return res.status(400).json({ error: '缺少 team_id 参数' });

  try {
    const standings = await footballApi.getTeamStandings(parseInt(team_id), league ? parseInt(league) : 39);
    if (!standings) return res.status(404).json({ error: '未找到积分数据' });
    res.json({ success: true, standings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/football/team-form
 * Query: team_id, league
 */
router.get('/team-form', async (req, res) => {
  const { team_id, league } = req.query;
  if (!team_id) return res.status(400).json({ error: '缺少 team_id 参数' });

  try {
    const form = await footballApi.getTeamForm(parseInt(team_id), league ? parseInt(league) : 39);
    res.json({ success: true, form });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
