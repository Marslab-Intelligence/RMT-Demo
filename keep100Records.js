import db from './server/db.js';

async function keep100Records() {
  console.log('Trimming database to keep exactly 100 renewals...');
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Identify the first 100 renewal IDs
    const toKeep = await client.query('SELECT id FROM renewals ORDER BY id ASC LIMIT 100');
    if (toKeep.rows.length === 0) {
      console.log('No renewals found to trim.');
      await client.query('COMMIT');
      return;
    }

    // Clean up dependent tables for records not in the 100 to keep
    const emailDel = await client.query(`
      DELETE FROM email_logs 
      WHERE renewal_id IS NOT NULL 
        AND renewal_id NOT IN (SELECT id FROM renewals ORDER BY id ASC LIMIT 100)
    `);
    console.log(`Deleted ${emailDel.rowCount} associated email logs.`);

    const epDel = await client.query(`
      DELETE FROM agent_episodes 
      WHERE renewal_id IS NOT NULL 
        AND renewal_id NOT IN (SELECT id FROM renewals ORDER BY id ASC LIMIT 100)
    `);
    console.log(`Deleted ${epDel.rowCount} associated agent episodes.`);

    // Delete renewals outside the first 100 (visits, renewal_history cascade automatically)
    const renDel = await client.query(`
      DELETE FROM renewals 
      WHERE id NOT IN (SELECT id FROM renewals ORDER BY id ASC LIMIT 100)
    `);
    console.log(`Deleted ${renDel.rowCount} excess renewals.`);

    // Verify remaining count
    const remaining = await client.query('SELECT count(*) FROM renewals');
    const statusCounts = await client.query('SELECT status, count(*) FROM renewals GROUP BY status ORDER BY count DESC');
    const sumVal = await client.query('SELECT SUM(value) as val, SUM(profit) as prof FROM renewals');

    await client.query('COMMIT');

    console.log('\n✅ Successfully retained exactly 100 records in the application:');
    console.log(`Total Renewals: ${remaining.rows[0].count}`);
    console.log('Status Breakdown:');
    for (const s of statusCounts.rows) {
      console.log(`  - ${s.status.padEnd(16)}: ${s.count}`);
    }
    console.log(`Total Pipeline Value: ₹${parseFloat(sumVal.rows[0].val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    console.log(`Total Profit:         ₹${parseFloat(sumVal.rows[0].prof).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to trim records, transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

keep100Records().catch(() => process.exit(1));
