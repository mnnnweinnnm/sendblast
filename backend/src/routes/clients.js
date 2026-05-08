const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { authenticate, requireAdmin, requireClientAdmin } = require('../middleware/auth');

const router = express.Router();

// List clients (Admin)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, 
        (SELECT COUNT(*) FROM campaigns WHERE client_id=c.id) as campaign_count,
        (SELECT COUNT(*) FROM contacts WHERE client_id=c.id) as contact_count
       FROM clients c ORDER BY c.created_at DESC`
    );
    res.json({ clients: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single client (Admin)
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM clients WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json({ client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create client (Admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { company_name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO clients (company_name, email, password_hash) VALUES ($1,$2,$3) RETURNING *',
      [company_name, email, hash]
    );
    res.json({ client: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// Update client (Admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { company_name, status, wallet_address } = req.body;
    const result = await db.query(
      'UPDATE clients SET company_name=COALESCE($1,company_name), status=COALESCE($2,status), wallet_address=COALESCE($3,wallet_address) WHERE id=$4 RETURNING *',
      [company_name, status, wallet_address, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    res.json({ client: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client (Admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adjust credit (Admin)
router.post('/:id/credits', authenticate, requireAdmin, async (req, res) => {
  try {
    const { amount, note } = req.body; // positive to add, negative to deduct
    const result = await db.query(
      'UPDATE clients SET credit_balance = GREATEST(0, credit_balance + $1) WHERE id=$2 RETURNING *',
      [amount, req.params.id]
    );
    res.json({ client: result.rows[0], adjustment: amount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
