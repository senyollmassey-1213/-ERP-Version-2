const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const generateToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'No token provided' });

    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);

    // Platform-level users (no tenant)
    if (['super_admin', 'client_servicing'].includes(decoded.role)) {
      const r = await query(
        `SELECT id, email, first_name, last_name, role, is_active
         FROM users WHERE id=$1 AND tenant_id IS NULL`,
        [decoded.userId]
      );
      if (!r.rows[0] || !r.rows[0].is_active)
        return res.status(401).json({ success: false, message: 'Account not found or inactive' });
      req.user     = r.rows[0];
      req.tenantId = null;
    } else {
      // Tenant users
      const r = await query(
        `SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug,
                t.industry_id, t.primary_color, t.secondary_color, t.logo_url,
                t.is_active AS tenant_active,
                i.name AS industry_name, i.slug AS industry_slug
         FROM users u
         JOIN tenants t ON t.id = u.tenant_id
         JOIN industries i ON i.id = t.industry_id
         WHERE u.id=$1 AND u.tenant_id=$2`,
        [decoded.userId, decoded.tenantId]
      );
      if (!r.rows[0] || !r.rows[0].is_active)
        return res.status(401).json({ success: false, message: 'Account not found or inactive' });
      if (!r.rows[0].tenant_active)
        return res.status(403).json({ success: false, message: 'Company account is inactive' });
      req.user     = r.rows[0];
      req.tenantId = r.rows[0].tenant_id;
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError')
      return res.status(401).json({ success: false, message: 'Token expired' });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Role guards
const requireRole   = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false, message: `Requires role: ${roles.join(' or ')}` });

const requireSuperAdmin      = requireRole('super_admin');
const requireClientServicing = requireRole('super_admin', 'client_servicing');
const requireUserAdmin       = requireRole('super_admin', 'client_servicing', 'user_admin');

const scopeToTenant = (req, res, next) => {
  if (!req.tenantId)
    return res.status(400).json({ success: false, message: 'No tenant context' });
  next();
};

// Check user has access to a module
const requireModuleAccess = (moduleSlugParam = 'moduleSlug') => async (req, res, next) => {
  try {
    if (['super_admin', 'client_servicing', 'user_admin'].includes(req.user.role)) return next();
    const slug = req.params[moduleSlugParam];
    const r = await query(
      `SELECT uma.is_visible FROM user_module_access uma
       JOIN modules m ON m.id = uma.module_id
       WHERE uma.user_id=$1 AND m.slug=$2 AND uma.tenant_id=$3`,
      [req.user.id, slug, req.tenantId]
    );
    if (!r.rows[0] || !r.rows[0].is_visible)
      return res.status(403).json({ success: false, message: 'No access to this module' });
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generateToken, authenticate,
  requireSuperAdmin, requireClientServicing, requireUserAdmin,
  requireRole, scopeToTenant, requireModuleAccess,
};
