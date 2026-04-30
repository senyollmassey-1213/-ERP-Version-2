const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');
const { asyncHandler, sendSuccess } = require('../middleware/helpers');

const login = asyncHandler(async (req, res) => {
  const { email, password, tenant_slug } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });

  let user, tenantData = null;

  if (!tenant_slug) {
    // Platform login (super_admin or client_servicing)
    const r = await query(
      `SELECT * FROM users WHERE email=$1 AND tenant_id IS NULL
       AND role IN ('super_admin','client_servicing')`,
      [email.toLowerCase()]
    );
    user = r.rows[0];
  } else {
    // Tenant login
    const tr = await query(
      `SELECT t.*, i.name AS industry_name, i.slug AS industry_slug
       FROM tenants t JOIN industries i ON i.id=t.industry_id
       WHERE t.slug=$1 AND t.is_active=true`,
      [tenant_slug]
    );
    if (!tr.rows[0])
      return res.status(404).json({ success: false, message: 'Company not found' });
    tenantData = tr.rows[0];

    const ur = await query(
      `SELECT * FROM users WHERE email=$1 AND tenant_id=$2`,
      [email.toLowerCase(), tenantData.id]
    );
    user = ur.rows[0];
  }

  if (!user)
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  if (!user.is_active)
    return res.status(403).json({ success: false, message: 'Account deactivated' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid)
    return res.status(401).json({ success: false, message: 'Invalid email or password' });

  await query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);

  const token = generateToken({
    userId: user.id,
    tenantId: user.tenant_id || null,
    role: user.role,
  });

  const userData = {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    role: user.role,
    tenantId: user.tenant_id,
  };

  if (tenantData) {
    userData.tenant = {
      id: tenantData.id,
      name: tenantData.name,
      slug: tenantData.slug,
      industryId: tenantData.industry_id,
      industryName: tenantData.industry_name,
      industrySlug: tenantData.industry_slug,
      primaryColor: tenantData.primary_color,
      secondaryColor: tenantData.secondary_color,
      logoUrl: tenantData.logo_url,
    };
  }

  sendSuccess(res, { token, user: userData }, 'Login successful');
});

const getProfile = asyncHandler(async (req, res) => {
  const u = req.user;
  sendSuccess(res, {
    id: u.id, email: u.email,
    firstName: u.first_name, lastName: u.last_name,
    role: u.role, tenantId: u.tenant_id,
    tenant: u.tenant_id ? {
      name: u.tenant_name, slug: u.tenant_slug,
      industryId: u.industry_id, industryName: u.industry_name,
      industrySlug: u.industry_slug,
      primaryColor: u.primary_color, secondaryColor: u.secondary_color,
    } : null,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone } = req.body;
  await query(
    `UPDATE users SET first_name=COALESCE($1,first_name), last_name=COALESCE($2,last_name),
     phone=COALESCE($3,phone), updated_at=NOW() WHERE id=$4`,
    [firstName, lastName, phone, req.user.id]
  );
  sendSuccess(res, {}, 'Profile updated');
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const r = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!await bcrypt.compare(currentPassword, r.rows[0].password_hash))
    return res.status(400).json({ success: false, message: 'Current password incorrect' });
  const hash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
  sendSuccess(res, {}, 'Password changed');
});

const resolveTenant = asyncHandler(async (req, res) => {
  const r = await query(
    `SELECT t.id, t.name, t.slug, t.primary_color, t.secondary_color, t.logo_url,
            i.name AS industry_name FROM tenants t
     JOIN industries i ON i.id=t.industry_id
     WHERE t.slug=$1 AND t.is_active=true`,
    [req.params.slug]
  );
  if (!r.rows[0]) return res.status(404).json({ success: false, message: 'Company not found' });
  sendSuccess(res, r.rows[0]);
});

module.exports = { login, getProfile, updateProfile, changePassword, resolveTenant };
