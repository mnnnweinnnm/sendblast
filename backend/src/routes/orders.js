const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticate);

// Get available packages
router.get('/packages', async (req, res) => {
  const result = await db.query("SELECT * FROM credit_packages WHERE status='active' ORDER BY sort_order ASC, credits ASC");
  res.json({ packages: result.rows });
});

// Create order
router.post('/', async (req, res) => {
  try {
    const { package_id } = req.body;
    const pkg = await db.query('SELECT * FROM credit_packages WHERE id=$1 AND status=$2', [package_id, 'active']);
    if (!pkg.rows[0]) return res.status(404).json({ error: 'Package not found' });

    // Generate a unique TRC20 deposit address
    // In production: use HD wallet to derive address per order
    // For now: use a fixed address + order ID as reference
    const orderId = crypto.randomUUID().split('-')[0].toUpperCase();
    const trc20_address = process.env.PLATFORM_USDT_ADDRESS || 'TRX1234567890abcdef'; // Replace with real address
    const expected_amount = pkg.rows[0].price_usdt.toString();

    const result = await db.query(
      `INSERT INTO orders (client_id, package_id, credits, usdt_amount, trc20_address, expected_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [req.user.client_id, package_id, pkg.rows[0].credits, pkg.rows[0].price_usdt, trc20_address, expected_amount]
    );

    res.json({ order: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get my orders
router.get('/', async (req, res) => {
  const result = await db.query(
    `SELECT o.*, cp.name as package_name FROM orders o
     LEFT JOIN credit_packages cp ON o.package_id=cp.id
     WHERE o.client_id=$1 ORDER BY o.created_at DESC`,
    [req.user.client_id]
  );
  res.json({ orders: result.rows });
});

// Check payment status (client polls this)
router.get('/:id/status', async (req, res) => {
  try {
    const result = await db.query('SELECT status, tx_hash, paid_at FROM orders WHERE id=$1 AND client_id=$2', [req.params.id, req.user.client_id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Order not found' });
    res.json({ status: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
