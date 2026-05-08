const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Platform Admin Login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM platform_admins WHERE email = $1', [email]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: result.rows[0].id, type: 'platform_admin' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({ token, user: { id: result.rows[0].id, email: result.rows[0].email, name: result.rows[0].name, type: 'platform_admin' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT cu.*, c.id as client_id, c.company_name, c.credit_balance, c.status as client_status FROM client_users cu JOIN clients c ON cu.client_id = c.id WHERE cu.email = $1', [email]);
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (result.rows[0].client_status !== 'active') return res.status(403).json({ error: 'Account suspended' });

    const token = jwt.sign({ id: result.rows[0].id, type: 'client_user' }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    res.json({
      token,
      user: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        name: result.rows[0].name,
        role: result.rows[0].role,
        client_id: result.rows[0].client_id,
        company_name: result.rows[0].company_name,
        credit_balance: result.rows[0].credit_balance,
        type: 'client_user'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
