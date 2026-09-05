import express from 'express';
import crypto from 'crypto';
import db from '../db.js';
import { sendCliqNotification } from '../services/cliqService.js';
import { broadcastEvent } from '../services/realtime.js';

const router = express.Router();

// SECURITY: this endpoint cannot use authenticateToken (Zoho Books calls it
// directly, with no user session), so it needs its own credential. Without
// this, the route was a fully unauthenticated write to any renewal record —
// confirmed live in a security audit: a single unauthenticated POST with a
// guessed RMT ID (these are sequential — RMT-0001, RMT-0002, ... — and
// trivially enumerable) could falsify invoice/payment status on any real
// client contract. Configure the same value as a custom header in Zoho
// Books' webhook settings (Settings > Automation > Webhooks > Headers).
const WEBHOOK_SECRET = process.env.ZOHO_BOOKS_WEBHOOK_SECRET || '';

function isValidWebhookSecret(providedSecret) {
  // Fails closed: if the secret isn't configured, every request is rejected
  // rather than the endpoint silently accepting unauthenticated writes
  // because setup was skipped — same philosophy as JWT_SECRET refusing to
  // start when missing, applied per-request since this route can't refuse
  // to mount without breaking the rest of the app.
  if (!WEBHOOK_SECRET) return false;
  const expected = Buffer.from(WEBHOOK_SECRET);
  const provided = Buffer.from(String(providedSecret || ''));
  // Length must match before timingSafeEqual (it throws on mismatched
  // lengths) — comparing lengths first leaks length via a non-constant-time
  // check, an accepted, standard tradeoff versus leaking any byte of the
  // secret itself, which the equal-length branch below fully avoids.
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}

router.post('/zoho-books', async (req, res) => {
  try {
    if (!isValidWebhookSecret(req.headers['x-webhook-secret'])) {
      console.warn('[Zoho Webhook] Rejected request: missing or invalid X-Webhook-Secret header.');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { invoice } = req.body;
    if (!invoice) {
      return res.status(400).json({ error: 'Missing invoice payload' });
    }

    const { invoice_number, status, total, date, custom_fields } = invoice;

    // Process only if the status indicates the invoice has been issued/sent
    const activeStatuses = ['sent', 'overdue', 'paid', 'partially_paid'];
    if (!status || !activeStatuses.includes(status.toLowerCase())) {
      return res.status(200).json({ message: `Ignored status change: status is "${status}"` });
    }

    // Extract RMT ID from custom fields
    const rmtIdField = custom_fields?.find(field => field.label === 'RMT ID');
    const rmtId = rmtIdField ? rmtIdField.value : null;

    if (!rmtId) {
      console.warn(`[Zoho Webhook] Received invoice ${invoice_number} but no RMT ID custom field found.`);
      return res.status(400).json({ error: 'RMT ID is required in custom fields for mapping.' });
    }

    // Query the record first to capture previous data
    const getRes = await db.query('SELECT * FROM renewals WHERE unique_id = $1', [rmtId]);
    if (getRes.rows.length === 0) {
      console.warn(`[Zoho Webhook] No matching RMT record found for RMT ID: ${rmtId}`);
      return res.status(404).json({ error: `RMT record ${rmtId} not found` });
    }

    const renewal = getRes.rows[0];

    let paymentState = 'unknown';
    const normalizedStatus = (status || '').toLowerCase();
    if (normalizedStatus === 'paid') paymentState = 'paid';
    else if (normalizedStatus === 'partially_paid') paymentState = 'partially_paid';
    else if (normalizedStatus === 'overdue') paymentState = 'overdue';
    else if (normalizedStatus === 'sent') paymentState = 'unpaid';

    // Find and update the corresponding renewal record
    const query = `
      UPDATE renewals 
      SET invoice_status = 'Sent',
          payment_state = $1,
          invoice_number = $2,
          invoice_value = $3,
          invoice_sent_date = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE unique_id = $5
      RETURNING *
    `;

    const { rows } = await db.query(query, [paymentState, invoice_number, parseFloat(total), date, rmtId]);
    const updated = rows[0];

    // Log to renewal_history
    const previousData = JSON.stringify({
      invoice_status: renewal.invoice_status,
      invoice_number: renewal.invoice_number,
      invoice_value: renewal.invoice_value,
      invoice_sent_date: renewal.invoice_sent_date
    });

    const newData = JSON.stringify({
      invoice_status: updated.invoice_status,
      invoice_number: updated.invoice_number,
      invoice_value: updated.invoice_value,
      invoice_sent_date: updated.invoice_sent_date
    });

    await db.query(`
      INSERT INTO renewal_history (renewal_id, action, previous_data, new_data, performed_by)
      VALUES ($1, 'edited', $2, $3, NULL)
    `, [updated.id, previousData, newData]);

    // Insert notification for Admin. There used to be a second row here for
    // role='finance' — that role was migrated away (db.js), no user can hold
    // it anymore, and a notification for a role nobody has is permanently
    // unreachable dead data, inserted on every single invoice sync.
    const notificationMsg = `Invoice #${invoice_number} (₹${parseFloat(total).toLocaleString('en-IN')}) has been automatically synced from Zoho Books for client "${updated.client_name}" (${updated.service}).`;
    await db.query(`
      INSERT INTO notifications (role, title, message, type, link)
      VALUES ('admin', 'Invoice Synced via Zoho', $1, 'info', $2)
    `, [notificationMsg, `/renewals?search=${updated.unique_id}`]);

    // Send Zoho Cliq notifications
    const cliqMessage = `🧾 *Invoice Automatically Synced (Zoho)*\n*Client ID:* ${updated.unique_id}\n*Client:* ${updated.client_name}\n*Service:* ${updated.service}\n*Invoice #:* ${invoice_number}\n*Invoice Value:* ₹${parseFloat(total).toLocaleString('en-IN')}\n*Invoice Sent Date:* ${new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    await sendCliqNotification(cliqMessage, false); // Finance channel
    await sendCliqNotification(cliqMessage, true);  // Sales channel

    console.log(`[Zoho Webhook] Successfully mapped and updated RMT record: ${rmtId} with Invoice #${invoice_number}`);
    broadcastEvent('renewals_updated', updated);
    return res.status(200).json({ message: 'Success', updated_record: updated });

  } catch (error) {
    console.error('[Zoho Webhook Error]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
