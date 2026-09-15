const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { queryOne, queryAll, run, saveDb } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dreamtipper-secret-key-2024';
const JWT_EXPIRES = '30d';

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    if (!email || !password) return res.status(400).json({ error: '邮箱和密码不能为空' });
    if (password.length < 6) return res.status(400).json({ error: '密码至少6位' });

    const exists = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(409).json({ error: '该邮箱已注册' });

    const hash = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    const name = nickname || email.split('@')[0];

    await run(`INSERT INTO users (id, email, password_hash, nickname, role, subscription_tier) VALUES (?, ?, ?, ?, 'user', 'free')`,
      [id, email, hash, name]);

    const user = await queryOne('SELECT id, email, nickname, role, subscription_tier, subscription_expire, created_at FROM users WHERE id = ?', [id]);
    const token = signToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: '邮箱或密码错误' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: '邮箱或密码错误' });

    const { password_hash, ...safeUser } = user;
    const token = signToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', require('../middleware/auth'), async (req, res) => {
  const user = await queryOne('SELECT id, email, nickname, role, subscription_tier, subscription_expire, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
});

router.put('/profile', require('../middleware/auth'), async (req, res) => {
  const { nickname } = req.body;
  await run('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.user.id]);
  const user = await queryOne('SELECT id, email, nickname, role, subscription_tier, subscription_expire, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
});

module.exports = router;
