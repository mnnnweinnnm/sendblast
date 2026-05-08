const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// List sending domains (client sees verified only, admin sees all)
router.get('/', async (req, res) => {
  let result;
  if (req.user.type === 'platform_admin') {
    result = await db.query('SELECT * FROM sending_domains ORDER BY created_at DESC');
  } else {
    result = await db.query("SELECT * FROM sending_domains WHERE status='verified' ORDER BY created_at DESC");
  }
  res.json({ domains: result.rows });
});

// Client (or admin) adds a new sending domain — creates in Resend and returns DNS records
router.post('/', async (req, res) => {
  try {
    const { domain, from_name_default } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain is required' });

    // Check duplicate
    const existing = await db.query('SELECT id FROM sending_domains WHERE domain=$1', [domain]);
    if (existing.rows[0]) return res.status(409).json({ error: '此網域已存在' });

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const rd = await resend.domains.create({ name: domain });

    const result = await db.query(
      `INSERT INTO sending_domains (domain, from_name_default, resend_domain_id, status, dkim_status, spf_status)
       VALUES ($1,$2,$3,'pending','pending','pending') RETURNING *`,
      [domain, from_name_default || null, rd.id]
    );
    res.json({ domain: result.rows[0], resend_records: rd.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify DNS records — client or admin
router.post('/:id/verify', async (req, res) => {
  try {
    const row = await db.query('SELECT * FROM sending_domains WHERE id=$1', [req.params.id]);
    if (!row.rows[0]) return res.status(404).json({ error: 'Domain not found' });
    const sd = row.rows[0];
    if (!sd.resend_domain_id) return res.status(400).json({ error: '尚未向 Resend 註冊此網域' });

    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    let info;
    try { info = await resend.domains.verify(sd.resend_domain_id); } catch (_) { info = null; }
    const detail = await resend.domains.get(sd.resend_domain_id);
    const status = (detail.status || 'pending').toLowerCase();
    const verified = status === 'verified';

    const upd = await db.query(
      `UPDATE sending_domains
       SET status=$1, dkim_status=$2, spf_status=$3,
           verified_at=COALESCE(verified_at, CASE WHEN $4 THEN NOW() ELSE NULL END)
       WHERE id=$5 RETURNING *`,
      [status, status, status, verified, sd.id]
    );
    res.json({ domain: upd.rows[0], records: detail.records, verify: info });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get DNS records for a domain (client side)
router.get('/:id/dns-records', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sending_domains WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Domain not found' });

    const domain = result.rows[0];
    if (domain.resend_domain_id) {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const rd = await resend.domains.get(domain.resend_domain_id);
      res.json({ domain: result.rows[0], records: rd.records });
    } else {
      res.json({ domain: result.rows[0], records: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
