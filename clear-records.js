import db from './server/db.js';

async function clearAllRecords() {
  console.log('Clearing all renewal records and associated transaction data...');
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Remove foreign-key dependent rows first
    const vLocRes = await client.query('DELETE FROM visit_locations');
    console.log(`Deleted ${vLocRes.rowCount} visit location records.`);

    const vRes = await client.query('DELETE FROM visits');
    console.log(`Deleted ${vRes.rowCount} visit records.`);

    const epRes = await client.query('DELETE FROM agent_episodes');
    console.log(`Deleted ${epRes.rowCount} agent episodes.`);

    const jobRes = await client.query('DELETE FROM agent_jobs');
    console.log(`Deleted ${jobRes.rowCount} agent jobs.`);

    const histRes = await client.query('DELETE FROM renewal_history');
    console.log(`Deleted ${histRes.rowCount} renewal history records.`);

    const emailRes = await client.query('DELETE FROM email_logs');
    console.log(`Deleted ${emailRes.rowCount} email log records.`);

    const notifRes = await client.query('DELETE FROM notifications');
    console.log(`Deleted ${notifRes.rowCount} notifications.`);

    const actRes = await client.query('DELETE FROM activity_logs');
    console.log(`Deleted ${actRes.rowCount} activity logs.`);

    const trashRes = await client.query('DELETE FROM trash_renewals');
    console.log(`Deleted ${trashRes.rowCount} trash renewals.`);

    // Remove all 1,000 renewals
    const renRes = await client.query('DELETE FROM renewals');
    console.log(`Deleted ${renRes.rowCount} renewal records.`);

    // Reset sequences back to 1
    await client.query("ALTER SEQUENCE renewals_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE renewal_history_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE visits_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE visit_locations_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE email_logs_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE notifications_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE activity_logs_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE agent_episodes_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE agent_jobs_id_seq RESTART WITH 1");

    await client.query('COMMIT');
    console.log('✅ Successfully cleared all 1,000 records and related data from the application database.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to clear records, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

clearAllRecords().catch(() => process.exit(1));
