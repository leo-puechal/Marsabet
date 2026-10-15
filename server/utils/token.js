const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Algorithme épinglé : empêche toute confusion d'algorithme (alg=none, etc.)
const ALGORITHM = 'HS256';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { algorithm: ALGORITHM, expiresIn: '24h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [ALGORITHM] });
}

module.exports = { signToken, verifyToken };
