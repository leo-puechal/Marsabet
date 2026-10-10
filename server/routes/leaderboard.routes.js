const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');

// Middleware d'authentification optionnel pour enrichir le leaderboard avec le rang du joueur connecté
function optionalAuth(req, res, next) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = db.prepare('SELECT id, username, coins FROM users WHERE id = ?').get(decoded.id);
    } catch (e) {
      // Ignorer si token invalide
    }
  }
  next();
}

router.get('/', optionalAuth, userController.getLeaderboard);

module.exports = router;
