const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const shopController = require('../controllers/shopController');
const authMiddleware = require('../middlewares/authMiddleware');

// Profil
router.get('/profile', authMiddleware, userController.getProfile);

// Boutique BDE & Livraisons directes
router.get('/shop', shopController.getProducts);
router.post('/shop/order', authMiddleware, shopController.orderProduct);
router.get('/shop/my-orders', authMiddleware, shopController.getMyOrders);
router.post('/deliveries', authMiddleware, shopController.orderProduct);
router.get('/deliveries', authMiddleware, shopController.getMyOrders);

// Codes promo
router.post('/redeem-code', authMiddleware, userController.redeemPromoCode);
router.get('/my-codes', authMiddleware, userController.getMyPromoCodes);

module.exports = router;
