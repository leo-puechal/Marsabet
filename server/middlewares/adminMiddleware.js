function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Non authentifié.' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès interdit. Cette section est réservée aux administrateurs du BDE.' });
  }

  next();
}

module.exports = adminMiddleware;
