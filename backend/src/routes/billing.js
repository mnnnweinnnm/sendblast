const express = require('express');
const db = require('../db/pool');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// Client billing
router.get('/', async (req, res) => {
  try {
    // Credit summary
    const client = await db.query('SELECT credit_balance, total_purchased, total_sent FROM clients WHERE id=$1', [req.user.client_id]);
    const orders = await db.query('SELECT * FROM orders WHERE client_id=$1 ORDER BY created_at DESC LIMIT 50', [req.user.client_id]);

    // Monthly stats
    const monthly = await db.query(
      `SELECT DATE_TRUNC('month', created_at) as month,
              COALESCE(SUM(credits),0) as credits_bought,
              COALESCE(SUM(usdt_amount),0) as usdt_spent
       FROM orders WHERE client_id=$1 AND status='confirmed'
       GROUP BY 1 ORDER BY 1 DESC LIMIT 12`,
      [req.user.client_id]
    );

    res.json({
      balance: client.rows[0].credit_balance,
      total_purchased: client.rows[0].total_purchased,
      total_sent: client.rows[0].total_sent,
      orders: orders.rows,
      monthly_stats: monthly.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Credit transaction history
router.get('/transactions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ct.*, cp.name as order_package_name, cam.name as campaign_name
       FROM credit_transactions ct
       LEFT JOIN orders o ON ct.order_id = o.id
       LEFT JOIN credit_packages cp ON o.package_id = cp.id
       LEFT JOIN campaigns cam ON ct.campaign_id = cam.id
       WHERE ct.client_id = $1
       ORDER BY ct.created_at DESC
       LIMIT 100`,
      [req.user.client_id]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
