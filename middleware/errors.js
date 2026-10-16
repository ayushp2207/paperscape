export function apiNotFound(req, res) {
  res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  const body = { error: status === 500 ? 'Internal server error' : err.message };
  if (err.details) body.details = err.details;
  res.status(status).json(body);
}
