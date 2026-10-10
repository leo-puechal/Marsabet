const express = require('express');
const router = express.Router();
const wheelController = require('../controllers/wheelController');
const authMiddleware = require('../middlewares/authMiddleware');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../database/db');

function optionalAuth(req, res, next) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = db.prepare('SELECT id, username, role, coins FROM users WHERE id = ?').get(decoded.id);
      if (user) req.user = user;
    } catch (e) {}
  }
  next();
}

router.get('/', optionalAuth, wheelController.listWheels);
router.get('/my-rewards', authMiddleware, wheelController.getMyRewards);
router.post('/confirm-delivery', authMiddleware, wheelController.confirmDelivery);
router.get('/:id', optionalAuth, wheelController.getWheelDetails);
router.post('/:id/spin', authMiddleware, wheelController.spin);

module.exports = router;
