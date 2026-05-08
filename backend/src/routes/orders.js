const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { deriveAddress, validTronAddress } = require('../services/tron');

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

    const idxResult = await db.query("SELECT nextval('order_deposit_index_seq') as idx");
    const depositIndex = Number(idxResult.rows[0].idx);
    const allocated = deriveAddress(depositIndex);
    const fallbackAddress = process.env.PLATFORM_USDT_ADDRESS;
    const trc20_address = allocated?.address || fallbackAddress;
    if (!trc20_address || !validTronAddress(trc20_address)) {
      return res.status(500).json({ error: 'TRC-20 payment address is not configured' });
    }

    const expected_amount = pkg.rows[0].price_usdt.toString();

    const result = await db.query(
      `INSERT INTO orders (client_id, package_id, credits, usdt_amount, trc20_address, deposit_path, deposit_index, expected_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [req.user.client_id, package_id, pkg.rows[0].credits, pkg.rows[0].price_usdt, trc20_address, allocated?.path || null, depositIndex, expected_amount]
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
