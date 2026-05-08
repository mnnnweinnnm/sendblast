const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// List sending domains (client can view)
router.get('/', async (req, res) => {
  const result = await db.query('SELECT * FROM sending_domains WHERE status=$1 ORDER BY created_at DESC', ['verified']);
  res.json({ domains: result.rows });
});

// Get DNS records for a domain (client side)
router.get('/:id/dns-records', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM sending_domains WHERE id=$1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Domain not found' });

    // If domain verified in Resend, get actual DNS records
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
