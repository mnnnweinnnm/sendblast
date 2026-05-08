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

module.exports = router;
