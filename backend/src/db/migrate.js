require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  try {
    await pool.query(schema);
    console.log('✅ Database schema applied successfully');

    // Insert default credit packages
    const packages = [
      { name: 'Starter', credits: 1000, price: 10 },
      { name: 'Growth', credits: 5000, price: 45 },
      { name: 'Business', credits: 10000, price: 80 },
      { name: 'Enterprise', credits: 50000, price: 350 }
    ];

    for (const pkg of packages) {
      await pool.query(
        `INSERT INTO credit_packages (name, credits, price_usdt, status, sort_order)
         VALUES ($1,$2,$3,'active',$4)
         ON CONFLICT (name) DO UPDATE SET
           credits=EXCLUDED.credits, price_usdt=EXCLUDED.price_usdt, sort_order=EXCLUDED.sort_order`,
        [pkg.name, pkg.credits, pkg.price, packages.indexOf(pkg)]
      );
    }
    console.log('✅ Default credit packages inserted');

    // No default sending domain — clients add their own via backend

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
