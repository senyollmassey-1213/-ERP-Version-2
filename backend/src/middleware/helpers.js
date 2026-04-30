const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+)\)/)?.[1] || 'field';
    return res.status(409).json({ success: false, message: `A record with this ${field} already exists` });
  }
  if (err.code === '23503')
    return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
  return res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
};

const notFound = (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const sendSuccess = (res, data = {}, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, data });

const getPagination = (req) => {
  const page   = Math.max(1, parseInt(req.query.page) || 1);
  const limit  = Math.min(100, parseInt(req.query.limit) || 20);
  return { page, limit, offset: (page - 1) * limit };
};

const paginatedResponse = (res, rows, total, page, limit) =>
  res.json({
    success: true,
    data: rows,
    pagination: {
      total, page, limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });

module.exports = { errorHandler, notFound, asyncHandler, sendSuccess, getPagination, paginatedResponse };
