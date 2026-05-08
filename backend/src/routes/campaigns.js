const express = require('express');
const { authenticate, requireClientAdmin } = require('../middleware/auth');
const db = require('../db/pool');
const { getQueue } = require('../services/queue');

const router = express.Router();

// All campaign routes require client auth
router.use(authenticate);

// List campaigns
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, cl.name as list_name, sd.domain as sending_domain
       FROM campaigns c
       LEFT JOIN contact_lists cl ON c.list_id = cl.id
       LEFT JOIN sending_domains sd ON c.sending_domain_id = sd.id
       WHERE c.client_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.client_id]
    );
    res.json({ campaigns: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single campaign
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, cl.name as list_name, sd.domain as sending_domain
       FROM campaigns c
       LEFT JOIN contact_lists cl ON c.list_id = cl.id
       LEFT JOIN sending_domains sd ON c.sending_domain_id = sd.id
       WHERE c.id = $1 AND c.client_id = $2`,
      [req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ campaign: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create campaign
router.post('/', async (req, res) => {
  try {
    const { name, subject, body_html, body_text, list_id, sending_domain_id, from_name, from_email } = req.body;

    let total_recipients = 0;
    if (list_id) {
      const count = await db.query(
        `SELECT COUNT(*) as cnt FROM contact_list_members clm
         JOIN contacts c ON clm.contact_id = c.id
         WHERE clm.list_id = $1 AND c.status = 'active'`,
        [list_id]
      );
      total_recipients = parseInt(count.rows[0].cnt);
    }

    const result = await db.query(
      `INSERT INTO campaigns (client_id, name, subject, body_html, body_text, list_id, sending_domain_id, from_name, from_email, total_recipients, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.client_id, name, subject, body_html, body_text, list_id, sending_domain_id, from_name, from_email, total_recipients, req.user.id]
    );
    res.json({ campaign: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update campaign
router.put('/:id', async (req, res) => {
  try {
    const { name, subject, body_html, body_text, list_id, sending_domain_id, from_name, from_email, scheduled_at } = req.body;

    let total_recipients = 0;
    if (list_id) {
      const count = await db.query(
        `SELECT COUNT(*) as cnt FROM contact_list_members clm
         JOIN contacts c ON clm.contact_id = c.id
         WHERE clm.list_id = $1 AND c.status = 'active'`,
        [list_id]
      );
      total_recipients = parseInt(count.rows[0].cnt);
    }

    const result = await db.query(
      `UPDATE campaigns SET name=$1, subject=$2, body_html=$3, body_text=$4, list_id=$5, sending_domain_id=$6,
       from_name=$7, from_email=$8, total_recipients=$9, scheduled_at=$10
       WHERE id=$11 AND client_id=$12 AND status='draft' RETURNING *`,
      [name, subject, body_html, body_text, list_id, sending_domain_id, from_name, from_email, total_recipients, scheduled_at, req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found or not editable' });
    res.json({ campaign: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send campaign (enqueue to BullMQ)
router.post('/:id/send', async (req, res) => {
  try {
    const camp = await db.query('SELECT * FROM campaigns WHERE id=$1 AND client_id=$2', [req.params.id, req.user.client_id]);
    if (!camp.rows[0]) return res.status(404).json({ error: 'Campaign not found' });
    if (!['draft', 'scheduled', 'paused'].includes(camp.rows[0].status)) {
      return res.status(400).json({ error: 'Campaign cannot be sent in current status' });
    }
    if (camp.rows[0].total_recipients > req.user.credit_balance) {
      return res.status(400).json({ error: 'Insufficient credit balance' });
    }

    await db.query("UPDATE campaigns SET status='sending' WHERE id=$1", [req.params.id]);

    const queue = getQueue('campaign-sender');
    await queue.add('send', { campaign_id: req.params.id, client_id: req.user.client_id }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    });

    res.json({ message: 'Campaign queued for sending', campaign_id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pause campaign
router.post('/:id/pause', async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE campaigns SET status='paused' WHERE id=$1 AND client_id=$2 AND status='sending' RETURNING *",
      [req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found or cannot be paused' });

    // Also pause the queue job
    const queue = getQueue('campaign-sender');
    // Mark job as paused (in practice we'd use job.pause(), but BullMQ pause is for the whole queue)
    res.json({ message: 'Campaign paused', campaign: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete campaign
router.delete('/:id', requireClientAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM campaigns WHERE id=$1 AND client_id=$2 AND status='draft' RETURNING id",
      [req.params.id, req.user.client_id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Campaign not found or not deletable' });
    res.json({ message: 'Campaign deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
