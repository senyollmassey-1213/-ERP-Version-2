const { pool } = require('./database');
require('dotenv').config();

const migrations = [

  // ── INDUSTRIES (Super Admin managed) ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── MODULES (Super Admin managed, common pool) ────────────────────────────
  `CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(50),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── INDUSTRY_MODULES: which modules belong to which industry + their order
  `CREATE TABLE IF NOT EXISTS industry_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    UNIQUE(industry_id, module_id)
  )`,

  // ── TITLE HEADS: fields defined per industry+module by Super Admin ────────
  `CREATE TABLE IF NOT EXISTS title_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    industry_id UUID NOT NULL REFERENCES industries(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    field_type VARCHAR(50) NOT NULL DEFAULT 'text',
    -- text | number | date | dropdown | boolean | currency | textarea | email | phone
    options JSONB,           -- for dropdown: [{label,value}]
    is_required BOOLEAN DEFAULT false,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(industry_id, module_id, name)
  )`,

  // ── TENANTS ───────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    industry_id UUID REFERENCES industries(id),
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#0b1628',
    secondary_color VARCHAR(20) DEFAULT '#c75b39',
    subscription_plan VARCHAR(50) DEFAULT 'trial',
    is_active BOOLEAN DEFAULT true,
    created_by_role VARCHAR(50),  -- 'super_admin' or 'client_servicing'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── TENANT_MODULES: subset of industry modules enabled per tenant ─────────
  `CREATE TABLE IF NOT EXISTS tenant_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    UNIQUE(tenant_id, module_id)
  )`,

  // ── USERS ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    -- NULL tenant_id = super_admin or client_servicing
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    -- roles: super_admin | client_servicing | user_admin | user
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_role CHECK (role IN ('super_admin','client_servicing','user_admin','user')),
    UNIQUE(email, tenant_id)
  )`,

  // ── USER_MODULE_ACCESS: which modules a user can see (set by user_admin) ──
  `CREATE TABLE IF NOT EXISTS user_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    is_visible BOOLEAN DEFAULT true,
    UNIQUE(user_id, module_id)
  )`,

  // ── RECORDS: all data for every module stored here ────────────────────────
  `CREATE TABLE IF NOT EXISTS records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id),
    industry_id UUID NOT NULL REFERENCES industries(id),
    record_number VARCHAR(50),
    title VARCHAR(255),
    data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(100) DEFAULT 'active',
    -- workflow statuses: active|converted|confirmed|complete|billed|cancelled
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    parent_record_id UUID REFERENCES records(id),  -- linked from workflow
    source_module_id UUID REFERENCES modules(id),  -- which module triggered creation
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── WORKFLOW_LOG: tracks every status conversion and auto-creation ─────────
  `CREATE TABLE IF NOT EXISTS workflow_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    from_record_id UUID REFERENCES records(id),
    to_record_id UUID REFERENCES records(id),
    from_module_id UUID REFERENCES modules(id),
    to_module_id UUID REFERENCES modules(id),
    trigger_status VARCHAR(100),
    triggered_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── AUDIT_LOG ─────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ── INDEXES ───────────────────────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_records_tenant    ON records(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_records_module    ON records(module_id)`,
  `CREATE INDEX IF NOT EXISTS idx_records_status    ON records(status)`,
  `CREATE INDEX IF NOT EXISTS idx_records_data      ON records USING GIN(data)`,
  `CREATE INDEX IF NOT EXISTS idx_users_tenant      ON users(tenant_id)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_title_heads_ind_mod ON title_heads(industry_id, module_id)`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🔄 Running migrations...');
    for (let i = 0; i < migrations.length; i++) {
      await client.query(migrations[i]);
      process.stdout.write(`  ✓ ${i + 1}/${migrations.length}\r`);
    }
    await client.query('COMMIT');
    console.log('\n✅ Migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

runMigrations().catch(console.error);
