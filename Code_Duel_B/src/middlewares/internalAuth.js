/**
 * Middleware: verifies the x-internal-secret header.
 * Used to protect endpoints that are only called by internal services
 * (e.g. Realtime_Server), not by end-users.
 */
function internalAuth(req, res, next) {
  const secret = process.env.INTERNAL_SECRET || "super-secret-internal-key-change-in-prod";

  if (req.headers['x-internal-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized: invalid internal secret' });
  }

  next();
}

module.exports = { internalAuth };
