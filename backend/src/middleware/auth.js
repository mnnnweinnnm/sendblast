const jwt = require('jsonwebtoken');
const db = require('../db/pool');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type === 'platform_admin') {
      const result = await db.query('SELECT * FROM platform_admins WHERE id = $1', [decoded.id]);
      if (!result.rows[0]) return res.status(401).json({ error: 'Admin not found' });
      req.user = { ...result.rows[0], type: 'platform_admin' };
    } else if (decoded.type === 'client_user') {
      const result = await db.query('SELECT cu.*, c.id as client_id, c.company_name, c.credit_balance, c.status as client_status FROM client_users cu JOIN clients c ON cu.client_id = c.id WHERE cu.id = $1', [decoded.id]);
      if (!result.rows[0]) return res.status(401).json({ error: 'User not found' });
      if (result.rows[0].client_status !== 'active') return res.status(403).json({ error: 'Client account suspended' });
      req.user = { ...result.rows[0], type: 'client_user' };
    } else {
      return res.status(401).json({ error: 'Invalid token' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.type !== 'platform_admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

const requireClientAdmin = (req, res, next) => {
  if (req.user.type !== 'client_user' || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Client admin access required' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, requireClientAdmin };
