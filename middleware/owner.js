const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Every browser sends its anonymous id in X-Owner-Id; all owned data is scoped by it.
export function requireOwner(req, res, next) {
  const ownerId = req.get('X-Owner-Id');
  if (!ownerId || !UUID_V4.test(ownerId)) {
    return res.status(400).json({ error: 'Missing or invalid X-Owner-Id header' });
  }
  req.ownerId = ownerId.toLowerCase();
  next();
}
