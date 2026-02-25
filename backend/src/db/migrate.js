const fs = require('fs');
const path = require('path');
const db = require('./index');

async function migrate() {
  console.log('[MIGRATE] Checking RateIntel schema...');
  
  try {
    // Check if tables exist
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'rate_snapshots'
      );
    `);
    
    if (result.rows[0].exists) {
      console.log('[MIGRATE] Schema already exists, skipping.');
      return true;
    }
    
    console.log('[MIGRATE] Creating RateIntel tables...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    await db.query(schemaSQL);
    
    console.log('[MIGRATE] Migration completed successfully.');
    return true;
  } catch (error) {
    console.error('[MIGRATE] Migration failed:', error.message);
    return false;
  }
}

module.exports = { migrate };
