const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dreamtipper-secret-key-2024';

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }
  try {
    const token = header.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
}

module.exports = auth;
