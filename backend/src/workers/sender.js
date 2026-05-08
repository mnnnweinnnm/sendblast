require('dotenv').config();
const { createWorker } = require('../services/queue');
const db = require('../db/pool');
const { Resend } = require('resend');
const Handlebars = require('handlebars');
const crypto = require('crypto');

const resend = new Resend(process.env.RESEND_API_KEY);
const BATCH_SIZE = 100;  // Resend batch limit
const RATE_LIMIT = 10;   // per second

const worker = createWorker('campaign-sender', async (job) => {
  const { campaign_id, client_id } = job.data;
  console.log(`[Sender] Starting campaign ${campaign_id}`);

  const camp = await db.query('SELECT * FROM campaigns WHERE id=$1 AND client_id=$2', [campaign_id, client_id]);
  if (!camp.rows[0]) throw new Error('Campaign not found');

  const domain = await db.query('SELECT * FROM sending_domains WHERE id=$1', [camp.rows[0].sending_domain_id]);
  const sendingDomain = domain.rows[0]?.domain || 'sendblast.top';
  const fromName = camp.rows[0].from_name || 'SendBlast';
  const fromEmail = camp.rows[0].from_email || `noreply@${sendingDomain}`;

  // Get contacts
  const contacts = await db.query(
    `SELECT c.* FROM contacts c
     JOIN contact_list_members clm ON c.id = clm.contact_id
     WHERE clm.list_id = $1 AND c.status = 'active' AND c.client_id = $2`,
    [camp.rows[0].list_id, client_id]
  );

  const total = contacts.rows.length;
  let sent = 0;

  // Compile email template
  const compileBody = Handlebars.compile(camp.rows[0].body_html || '');
  const compileText = Handlebars.compile(camp.rows[0].body_text || '');

  for (let i = 0; i < contacts.rows.length; i += BATCH_SIZE) {
    const batch = contacts.rows.slice(i, i + BATCH_SIZE);

    // Build batch payload
    const emails = batch.map(contact => {
      const unsubscribeToken = contact.unsubscribe_token || crypto.randomBytes(32).toString('hex');
      if (!contact.unsubscribe_token) {
        db.query('UPDATE contacts SET unsubscribe_token=$1 WHERE id=$2', [unsubscribeToken, contact.id]);
      }

      const vars = {
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email,
        unsubscribe_url: `${process.env.FRONTEND_URL}/unsubscribe?token=${unsubscribeToken}`
      };

      return {
        from: `${fromName} <${fromEmail}>`,
        to: contact.email,
        subject: camp.rows[0].subject,
        html: compileBody(vars) + `<p style="font-size:10px;color:#999;"><a href="${vars.unsubscribe_url}">Unsubscribe</a></p>`,
        text: compileText(vars) + `\n\nUnsubscribe: ${vars.unsubscribe_url}`,
        custom_args: { campaign_id, contact_id: contact.id, client_id }
      };
    });

    // Send batch
    const result = await resend.batch.send(emails);
    console.log(`[Sender] Batch ${Math.floor(i/BATCH_SIZE)+1}: sent ${emails.length} emails`);

    // Deduct credits
    await db.query('UPDATE clients SET credit_balance = credit_balance - $1, total_sent = total_sent + $1 WHERE id=$2', [emails.length, client_id]);

    // Log events
    for (const contact of batch) {
      await db.query(
        'INSERT INTO email_events (campaign_id, client_id, contact_id, event_type) VALUES ($1,$2,$3,$4)',
        [campaign_id, client_id, contact.id, 'sent']
      );
    }

    // Rate limit: wait between batches
    if (i + BATCH_SIZE < total) {
      await new Promise(r => setTimeout(r, (BATCH_SIZE / RATE_LIMIT) * 1000));
    }
  }

  await db.query("UPDATE campaigns SET status='sent', sent_at=NOW(), sent_count=$1 WHERE id=$2", [total, campaign_id]);
  console.log(`[Sender] Campaign ${campaign_id} complete: ${total} emails sent`);
});

worker.on('completed', (job) => console.log(`[Sender] Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`[Sender] Job ${job?.id} failed:`, err.message));
