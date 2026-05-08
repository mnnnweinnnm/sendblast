require('dotenv').config();
const db = require('../db/pool');
const { fetchIncomingUsdt, txMatchesAmount } = require('../services/tron');

const INTERVAL_MS = Number(process.env.PAYMENT_MONITOR_INTERVAL_MS || 60000);
const MAX_AGE_HOURS = Number(process.env.PAYMENT_MONITOR_MAX_AGE_HOURS || 72);

async function checkPendingOrders() {
  if (!process.env.TRONGRID_API_KEY) {
    console.warn('[PaymentMonitor] TRONGRID_API_KEY missing; skipping payment polling');
    return { skipped: true };
  }

  const pending = await db.query(
    `SELECT id, client_id, credits, usdt_amount, expected_amount, trc20_address
     FROM orders
     WHERE status='pending'
       AND trc20_address IS NOT NULL
       AND created_at > NOW() - ($1 * INTERVAL '1 hour')
     ORDER BY created_at ASC
     LIMIT 50`,
    [MAX_AGE_HOURS]
  );

  let confirmed = 0;
  for (const order of pending.rows) {
    try {
      const txs = await fetchIncomingUsdt(order.trc20_address);
      const match = txs.find(tx => txMatchesAmount(tx, order.expected_amount || order.usdt_amount));
      if (!match) continue;

      await db.query('BEGIN');
      const updated = await db.query(
        `UPDATE orders
         SET status='confirmed', paid_at=NOW(), tx_hash=$1
         WHERE id=$2 AND status='pending'
         RETURNING id`,
        [match.transaction_id, order.id]
      );
      if (updated.rows[0]) {
        await db.query(
          `UPDATE clients
           SET credit_balance = credit_balance + $1,
               total_purchased = total_purchased + $1
           WHERE id=$2`,
          [order.credits, order.client_id]
        );
        confirmed++;
      }
      await db.query('COMMIT');
      console.log(`[PaymentMonitor] confirmed order ${order.id} tx=${match.transaction_id}`);
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      console.error(`[PaymentMonitor] order ${order.id} error:`, err.message);
    }
  }
  return { checked: pending.rows.length, confirmed };
}

async function loop() {
  await checkPendingOrders();
  setTimeout(loop, INTERVAL_MS);
}

if (require.main === module) {
  console.log(`[PaymentMonitor] started interval=${INTERVAL_MS}ms`);
  loop().catch(err => {
    console.error('[PaymentMonitor] fatal:', err);
    process.exit(1);
  });
}

module.exports = { checkPendingOrders };
