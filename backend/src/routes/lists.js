const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// List contact lists
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cl.*, (SELECT COUNT(*) FROM contact_list_members WHERE list_id=cl.id) as member_count
       FROM contact_lists cl WHERE cl.client_id=$1 ORDER BY cl.created_at DESC`,
      [req.user.client_id]
    );
    res.json({ lists: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single list
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT cl.*, (SELECT COUNT(*) FROM contact_list_members WHERE list_id=cl.id) as member_count
       FROM contact_lists cl WHERE cl.id=$1 AND cl.client_id=$2`,
      [req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'List not found' });
    res.json({ list: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create list
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await db.query(
      'INSERT INTO contact_lists (client_id, name, description, created_by) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.client_id, name, description, req.user.id]
    );
    res.json({ list: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update list
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await db.query(
      'UPDATE contact_lists SET name=COALESCE($1,name), description=COALESCE($2,description) WHERE id=$3 AND client_id=$4 RETURNING *',
      [name, description, req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'List not found' });
    res.json({ list: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete list
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM contact_lists WHERE id=$1 AND client_id=$2 RETURNING id',
      [req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'List not found' });
    res.json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
