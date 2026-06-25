/**
 * Migration: Food Court support
 * Run: node migrations/add_food_court.js
 */

const { pool } = require('../src/config/database');
require('dotenv').config();

const migrations = [

  // Add tenant_type to tenants
  `ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS tenant_type VARCHAR(20) NOT NULL DEFAULT 'standard'`,

  // Food court members linking table
  `CREATE TABLE IF NOT EXISTS food_court_members (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    food_court_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    member_tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    display_order         INTEGER DEFAULT 0,
    is_active             BOOLEAN DEFAULT true,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (food_court_tenant_id, member_tenant_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_food_court_members_fc  ON food_court_members(food_court_tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_food_court_members_mem ON food_court_members(member_tenant_id)`,
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🔄 Running food court migration...');
    for (let i = 0; i < migrations.length; i++) {
      await client.query(migrations[i]);
      process.stdout.write(`  ✓ ${i + 1}/${migrations.length}\r`);
    }
    await client.query('COMMIT');
    console.log('\n✅ Food court migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

run().catch(console.error);
