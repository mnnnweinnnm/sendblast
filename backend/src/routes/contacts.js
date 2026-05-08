const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticate);

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// List contacts
router.get('/', async (req, res) => {
  try {
    const { list_id, status, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let query = `SELECT c.* FROM contacts c WHERE c.client_id=$1`;
    const params = [req.user.client_id];

    if (list_id) { params.push(list_id); query += ` AND c.id IN (SELECT contact_id FROM contact_list_members WHERE list_id=$${params.length})`; }
    if (status) { params.push(status); query += ` AND c.status=$${params.length}`; }
    if (search) { params.push(`%${search}%`); query += ` AND (c.email ILIKE $${params.length} OR c.first_name ILIKE $${params.length})`; }

    query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const countResult = await db.query(`SELECT COUNT(*) as total FROM contacts WHERE client_id=$1`, [req.user.client_id]);

    res.json({ contacts: result.rows, total: parseInt(countResult.rows[0].total), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add single contact
router.post('/', async (req, res) => {
  try {
    const { email, first_name, last_name, phone, tags, metadata, list_id } = req.body;
    const unsubscribe_token = crypto.randomBytes(32).toString('hex');
    const result = await db.query(
      `INSERT INTO contacts (client_id, email, first_name, last_name, phone, tags, metadata, unsubscribe_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.client_id, email, first_name, last_name, phone, tags || [], metadata || {}, unsubscribe_token]
    );
    if (list_id) {
      await db.query('INSERT INTO contact_list_members (contact_id, list_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [result.rows[0].id, list_id]);
    }
    res.json({ contact: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists for this client' });
    res.status(500).json({ error: err.message });
  }
});

// Bulk CSV import to a list
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { list_id } = req.body;
    const records = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true });

    let imported = 0, skipped = 0;
    for (const row of records) {
      try {
        const email = row.email || row.Email || row.EMAIL;
        if (!email || !email.includes('@')) { skipped++; continue; }

        const unsubscribe_token = crypto.randomBytes(32).toString('hex');
        const first_name = row.first_name || row.FirstName || row.firstName || row.name || row.Name || '';
        const last_name = row.last_name || row.LastName || row.lastName || '';

        const result = await db.query(
          `INSERT INTO contacts (client_id, email, first_name, last_name, unsubscribe_token)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (client_id, email) DO UPDATE SET first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name
           RETURNING id`,
          [req.user.client_id, email.toLowerCase().trim(), first_name, last_name, unsubscribe_token]
        );
        if (list_id) {
          await db.query('INSERT INTO contact_list_members (contact_id, list_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [result.rows[0].id, list_id]);
        }
        imported++;
      } catch (e) {
        skipped++;
      }
    }

    // Update list count
    if (list_id) {
      const count = await db.query('SELECT COUNT(*) as cnt FROM contact_list_members WHERE list_id=$1', [list_id]);
      await db.query('UPDATE contact_lists SET contact_count=$1 WHERE id=$2', [count.rows[0].cnt, list_id]);
    }

    res.json({ imported, skipped, total: records.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unsubscribe
router.post('/unsubscribe', async (req, res) => {
  try {
    const { token } = req.body;
    const result = await db.query('UPDATE contacts SET status=$1 WHERE unsubscribe_token=$2 RETURNING id', ['unsubscribed', token]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Invalid token' });
    res.json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete contact
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM contacts WHERE id=$1 AND client_id=$2', [req.params.id, req.user.client_id]);
    res.json({ message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
