const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { Resend } = require('resend');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

// All admin routes
router.use(authenticate, requireAdmin);

// === Platform Admins ===
router.get('/admins', async (req, res) => {
  const result = await db.query('SELECT id, email, name, role, created_at FROM platform_admins ORDER BY created_at DESC');
  res.json({ admins: result.rows });
});

router.post('/admins', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = await db.query(
      'INSERT INTO platform_admins (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email, name, role',
      [email, hash, name]
    );
    res.json({ admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// === Credit Packages ===
router.get('/packages', async (req, res) => {
  const result = await db.query('SELECT * FROM credit_packages ORDER BY sort_order ASC, credits ASC');
  res.json({ packages: result.rows });
});

router.post('/packages', async (req, res) => {
  try {
    const { name, credits, price_usdt, status } = req.body;
    const result = await db.query(
      'INSERT INTO credit_packages (name, credits, price_usdt, status) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, credits, price_usdt, status || 'active']
    );
    res.json({ package: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/packages/:id', async (req, res) => {
  try {
    const { name, credits, price_usdt, status } = req.body;
    const result = await db.query(
      'UPDATE credit_packages SET name=COALESCE($1,name), credits=COALESCE($2,credits), price_usdt=COALESCE($3,price_usdt), status=COALESCE($4,status) WHERE id=$5 RETURNING *',
      [name, credits, price_usdt, status, req.params.id]
    );
    res.json({ package: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/packages/:id', async (req, res) => {
  await db.query('DELETE FROM credit_packages WHERE id=$1', [req.params.id]);
  res.json({ message: 'Package deleted' });
});

// === Orders ===
router.get('/orders', async (req, res) => {
  try {
    const { status, client_id } = req.query;
    let query = `SELECT o.*, c.company_name, cp.name as package_name 
                 FROM orders o JOIN clients c ON o.client_id=c.id 
                 LEFT JOIN credit_packages cp ON o.package_id=cp.id`;
    const params = [];
    const conditions = [];
    if (status) { conditions.push(`o.status=$1`); params.push(status); }
    if (client_id) { conditions.push(`o.client_id=$${params.length+1}`); params.push(client_id); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY o.created_at DESC';
    const result = await db.query(query, params);
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Global Stats ===
router.get('/stats', async (req, res) => {
  try {
    const [clients, totalSent, totalRevenue, recentOrders] = await Promise.all([
      db.query('SELECT COUNT(*) as cnt FROM clients WHERE status=$1', ['active']),
      db.query('SELECT COALESCE(SUM(total_sent),0) as cnt FROM clients'),
      db.query("SELECT COALESCE(SUM(usdt_amount),0) as total FROM orders WHERE status='confirmed'"),
      db.query("SELECT o.*, c.company_name FROM orders o JOIN clients c ON o.client_id=c.id ORDER BY o.created_at DESC LIMIT 10")
    ]);
    res.json({
      total_clients: parseInt(clients.rows[0].cnt),
      total_sent: parseInt(totalSent.rows[0].cnt),
      total_revenue_usdt: parseFloat(totalRevenue.rows[0].total),
      recent_orders: recentOrders.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Sending Domains ===
router.post('/domains', async (req, res) => {
  try {
    const { domain, from_name_default } = req.body;
    // Add to Resend
    const rd = await resend.domains.create({ name: domain });
    const result = await db.query(
      'INSERT INTO sending_domains (domain, from_name_default, resend_domain_id, status, dkim_status, spf_status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [domain, from_name_default, rd.id, 'pending', 'pending', 'pending']
    );
    res.json({ domain: result.rows[0], resend_records: rd.records });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/domains', async (req, res) => {
  const result = await db.query('SELECT * FROM sending_domains ORDER BY created_at DESC');
  res.json({ domains: result.rows });
});

router.delete('/domains/:id', async (req, res) => {
  await db.query('DELETE FROM sending_domains WHERE id=$1', [req.params.id]);
  res.json({ message: 'Domain deleted' });
});

module.exports = router;
