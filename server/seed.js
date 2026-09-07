import bcrypt from 'bcryptjs';
import db, { initDb } from './db.js';

async function seed() {
  // SECURITY: refuse to run against production — see server/seed1000Dummy.js
  // for why (real-looking committed accounts with weak passwords).
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run: NODE_ENV=production. This seeds demo accounts with weak, publicly-committed passwords.');
    process.exit(1);
  }
  await initDb();
  
  try {
    const { rows } = await db.query('SELECT COUNT(*) as count FROM users');
    const count = parseInt(rows[0].count, 10);
    
    if (count === 0) {
      console.log('Seeding initial users...');
      const salt = await bcrypt.genSalt(10);
      const salesPassword = await bcrypt.hash('sales123', salt);
      const adminPassword = await bcrypt.hash('admin123', salt);

      // initDb() has already seeded the Software department + its starting
      // categories by this point — reuse them for the demo dept_admin/user.
      const { rows: [softwareDept] } = await db.query("SELECT id FROM departments WHERE slug = 'software-renewals'");
      const { rows: categories } = await db.query('SELECT id FROM categories WHERE department_id = $1 ORDER BY id ASC', [softwareDept.id]);

      const users = [
        ['ranjithkumar.v@marslab.work', 'ranjithkumar.v@marslab.work', salesPassword, 'Ranjith Kumar', 'user', '#3b82f6', softwareDept.id, categories[0]?.id ?? null],
        ['sakthivel.k@marslab.work', 'sakthivel.k@marslab.work', salesPassword, 'Sakthivel K', 'user', '#10b981', softwareDept.id, categories[1]?.id ?? categories[0]?.id ?? null],
        ['sameerulrahman.f@marslab.work', 'sameerulrahman.f@marslab.work', adminPassword, 'Sameerul Rahman', 'super_admin', '#f59e0b', null, null]
      ];

      for (const user of users) {
        await db.query(`
          INSERT INTO users (username, email, password, full_name, role, avatar_color, department_id, category_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, user);
      }

      console.log('Users seeded successfully!');
      console.log('Login credentials:');
      console.log('- User: ranjithkumar.v@marslab.work / sales123');
      console.log('- User: sakthivel.k@marslab.work / sales123');
      console.log('- Super Admin: sameerulrahman.f@marslab.work / admin123');
    } else {
      console.log('Database already seeded.');
    }
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    process.exit();
  }
}

seed();
