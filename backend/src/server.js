const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/helpers');
const { pool } = require('./config/database');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(rateLimit({ windowMs: 15*60*1000, max: 500 }));
app.use('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 30,
  message: { success: false, message: 'Too many login attempts' } }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'Drusshti ERP v2', timestamp: new Date().toISOString() }));

app.use('/api/auth',           require('./routes/auth'));
app.use('/api/industries',     require('./routes/industries'));
app.use('/api/title-heads',    require('./routes/titleHeads'));
app.use('/api/tenants',        require('./routes/tenants'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/users/platform', require('./routes/platformUsers'));
app.use('/api/modules',        require('./routes/modules'));
app.use('/api/records',        require('./routes/records'));
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/skus',           require('./routes/skus'));

app.use(notFound);
app.use(errorHandler);

const runQRMigrations = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_skus (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
        record_id     UUID REFERENCES records(id) ON DELETE CASCADE,
        module_id     UUID REFERENCES modules(id) ON DELETE SET NULL,
        sku_code      VARCHAR(100) UNIQUE NOT NULL,
        label_type    VARCHAR(20) DEFAULT 'item',
        generated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        is_assigned   BOOLEAN DEFAULT false,
        qr_data       TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scan_events (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
        sku_id      UUID NOT NULL REFERENCES item_skus(id) ON DELETE CASCADE,
        scanned_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        action      VARCHAR(50) DEFAULT 'scanned',
        location    VARCHAR(255),
        notes       TEXT,
        scanned_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_skus_tenant ON item_skus(tenant_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_skus_record ON item_skus(record_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_item_skus_code   ON item_skus(sku_code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_scan_events_sku  ON scan_events(sku_id)`);
    console.log('✅ QR tables ready');
  } catch (err) {
    console.error('❌ QR migration error:', err.message);
  }
};

app.listen(PORT, async () => {
  console.log('\n╔════════════════════════════════╗');
  console.log('║  DRUSSHTI ERP v2 — API Server  ║');
  console.log('╚════════════════════════════════╝');
  console.log(`  Port : ${PORT}`);
  console.log(`  Env  : ${process.env.NODE_ENV || 'development'}\n`);
  await runQRMigrations();
});

module.exports = app;
