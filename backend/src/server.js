const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/helpers');

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

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/industries',  require('./routes/industries'));
app.use('/api/title-heads', require('./routes/titleHeads'));
app.use('/api/tenants',     require('./routes/tenants'));
app.use('/api/users',          require('./routes/users'));
app.use('/api/users/platform', require('./routes/platformUsers'));
app.use('/api/modules',     require('./routes/modules'));
app.use('/api/records',     require('./routes/records'));
app.use('/api/dashboard',   require('./routes/dashboard'));
app.use('/api/skus',        require('./routes/skus'));

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════╗');
  console.log('║  DRUSSHTI ERP v2 — API Server  ║');
  console.log('╚════════════════════════════════╝');
  console.log(`  Port : ${PORT}`);
  console.log(`  Env  : ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
