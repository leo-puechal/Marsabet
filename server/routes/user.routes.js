const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// Profil
router.get('/profile', authMiddleware, userController.getProfile);

// Codes promo
router.post('/redeem-code', authMiddleware, userController.redeemPromoCode);
router.get('/my-codes', authMiddleware, userController.getMyPromoCodes);

module.exports = router;
