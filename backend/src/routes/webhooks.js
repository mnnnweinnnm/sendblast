const express = require('express');
const crypto = require('crypto');
const db = require('../db/pool');

const router = express.Router();

// Resend Webhook
router.post('/resend', async (req, res) => {
  try {
    const signature = req.headers['resend-signature'];
    const secret = process.env.RESEND_WEBHOOK_SECRET;

    // Verify signature
    if (secret && signature) {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(JSON.stringify(req.body));
      const expected = `v1=${hmac.digest('hex')}`;
      if (signature !== expected) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const { type, data } = event;
      if (!type || !data) continue;

      const { email, campaign_id, contact_id, custom_args } = data;
      const resolvedCampaignId = campaign_id || custom_args?.campaign_id;
      const resolvedContactId = contact_id || custom_args?.contact_id;
      const resolvedClientId = custom_args?.client_id;

      if (!resolvedClientId || !resolvedContactId) continue;

      // Map event type
      let event_type;
      switch (type) {
        case 'email.sent': event_type = 'sent'; break;
        case 'email.delivered': event_type = 'delivered'; break;
        case 'email.bounced': event_type = 'bounced'; break;
        case 'email.complained': event_type = 'complaint'; break;
        case 'email.opened': event_type = 'open'; break;
        case 'email.clicked': event_type = 'click'; break;
        default: continue;
      }

      // Insert event
      await db.query(
        `INSERT INTO email_events (campaign_id, client_id, contact_id, event_type, metadata)
         VALUES ($1,$2,$3,$4,$5)`,
        [resolvedCampaignId || null, resolvedClientId, resolvedContactId, event_type, JSON.stringify(data)]
      );

      // Update campaign counters
      if (resolvedCampaignId) {
        const counter = event_type === 'delivered' ? 'delivered_count' :
                        event_type === 'open' ? 'open_count' :
                        event_type === 'click' ? 'click_count' :
                        event_type === 'bounced' ? 'bounce_count' : 'complaint_count';
        await db.query(`UPDATE campaigns SET ${counter}=${counter}+1 WHERE id=$1`, [resolvedCampaignId]);

        // Handle bounces
        if (event_type === 'bounced') {
          await db.query("UPDATE contacts SET status='bounced' WHERE id=$1", [resolvedContactId]);
        }
        if (event_type === 'complaint') {
          await db.query("UPDATE contacts SET status='unsubscribed' WHERE id=$1", [resolvedContactId]);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
