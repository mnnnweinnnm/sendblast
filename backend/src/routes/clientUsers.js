const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { authenticate, requireClientAdmin } = require('../middleware/auth');

const router = express.Router();

// List users under the current client
router.get('/', authenticate, async (req, res) => {
  try {
    let clientId;
    if (req.user.type === 'platform_admin' && req.query.client_id) {
      clientId = req.query.client_id;
    } else if (req.user.type === 'client_user') {
      const me = await db.query('SELECT client_id FROM client_users WHERE id=$1', [req.user.id]);
      clientId = me.rows[0].client_id;
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query(
      'SELECT id, email, name, role, created_at FROM client_users WHERE client_id=$1 ORDER BY created_at',
      [clientId]
    );
    res.json({ users: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new user under the current client
router.post('/', authenticate, requireClientAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, name are required' });
    }

    const me = await db.query('SELECT client_id FROM client_users WHERE id=$1', [req.user.id]);
    const clientId = me.rows[0].client_id;
    const hash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO client_users (client_id, email, password_hash, name, role)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, email, name, role, created_at`,
      [clientId, email, hash, name, role || 'operator']
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Delete a user
router.delete('/:id', authenticate, requireClientAdmin, async (req, res) => {
  try {
    const me = await db.query('SELECT client_id FROM client_users WHERE id=$1', [req.user.id]);
    const clientId = me.rows[0].client_id;

    // Can't delete yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const result = await db.query(
      'DELETE FROM client_users WHERE id=$1 AND client_id=$2 RETURNING id',
      [req.params.id, clientId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
