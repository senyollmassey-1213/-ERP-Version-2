import axios from 'axios';

const BASE = process.env.REACT_APP_API_URL || 'backend-production-4750.up.railway.app';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('drush_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  res => res.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('drush_token');
      localStorage.removeItem('drush_user');
      window.location.href = '/login';
    }
    return Promise.reject(new Error(err.response?.data?.message || err.message || 'Error'));
  }
);

export const authAPI = {
  login: (email, password, tenantSlug) => api.post('/auth/login', { email, password, tenant_slug: tenantSlug }),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (d) => api.put('/auth/me', d),
  changePassword: (cur, next) => api.put('/auth/me/password', { currentPassword: cur, newPassword: next }),
  resolveTenant: (slug) => api.get(`/auth/tenant/${slug}`),
};

export const industryAPI = {
  list: () => api.get('/industries'),
  get: (id) => api.get(`/industries/${id}`),
  create: (d) => api.post('/industries', d),
  update: (id, d) => api.put(`/industries/${id}`, d),
  addModule: (id, d) => api.post(`/industries/${id}/modules`, d),
};

export const titleHeadAPI = {
  list: (industryId, moduleId) => api.get(`/title-heads/${industryId}/${moduleId}`),
  create: (industryId, moduleId, d) => api.post(`/title-heads/${industryId}/${moduleId}`, d),
  update: (id, d) => api.put(`/title-heads/${id}`, d),
  delete: (id) => api.delete(`/title-heads/${id}`),
};

export const tenantAPI = {
  list: (p) => api.get('/tenants', { params: p }),
  get: (id) => api.get(`/tenants/${id}`),
  create: (d) => api.post('/tenants', d),
  update: (id, d) => api.put(`/tenants/${id}`, d),
  delete: (id) => api.delete(`/tenants/${id}`),
  resolveBranding: (slug) => api.get(`/auth/tenant/${slug}`),
};

export const userAPI = {
  list: (p) => api.get('/users', { params: p }),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.put(`/users/${id}`, d),
  delete: (id) => api.delete(`/users/${id}`),
  resetPassword: (id, pw) => api.post(`/users/${id}/reset-password`, { newPassword: pw }),
  getModuleAccess: (userId) => api.get(`/users/${userId}/modules`),
  setModuleAccess: (userId, access) => api.put(`/users/${userId}/modules`, { moduleAccess: access }),
};

export const moduleAPI = {
  list: () => api.get('/modules'),
  allModules: () => api.get('/modules/all'),
  byIndustry: (industryId) => api.get(`/modules/industry/${industryId}`),
  titleHeads: (moduleSlug) => api.get(`/modules/${moduleSlug}/title-heads`),
};

export const recordAPI = {
  list: (slug, p) => api.get(`/records/${slug}`, { params: p }),
  stats: (slug) => api.get(`/records/${slug}/stats`),
  get: (id) => api.get(`/records/id/${id}`),
  create: (slug, d) => api.post(`/records/${slug}`, d),
  update: (id, d) => api.put(`/records/id/${id}`, d),
  delete: (id) => api.delete(`/records/id/${id}`),
};

export const dashboardAPI = {
  get: () => api.get('/dashboard'),
  getSuper: () => api.get('/dashboard/super'),
};

export default api;
