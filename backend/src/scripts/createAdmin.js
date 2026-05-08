require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

async function createAdmin() {
  const email = process.argv[2] || 'admin@3cmark.shop';
  const password = process.argv[3] || 'change-me-immediately';
  const name = process.argv[4] || 'Admin';

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO platform_admins (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id, email',
      [email, hash, name]
    );
    console.log(`✅ Admin created: ${result.rows[0].email}`);
    console.log(`   Password: ${password} (change it immediately!)`);
  } catch (err) {
    if (err.code === '23505') {
      console.log('Admin already exists');
    } else {
      console.error('Error:', err.message);
    }
  } finally {
    await pool.end();
  }
}

createAdmin();
