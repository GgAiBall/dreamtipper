const express = require('express');
const router = express.Router();
const { queryAll, queryOne } = require('../db');

// 公开：实时分析文章列表
router.get('/', async (req, res) => {
  try {
    const rows = await queryAll(
      'SELECT id, title, category, content, image_url, tier_required, created_at FROM analysis_posts ORDER BY created_at DESC'
    );
    res.json({ posts: rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 公开：单篇详情
router.get('/:id', async (req, res) => {
  try {
    const row = await queryOne('SELECT * FROM analysis_posts WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: '未找到该文章' });
    res.json({ post: row });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
