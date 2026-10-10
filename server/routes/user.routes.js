const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/profile', authMiddleware, userController.getProfile);
router.get('/shop', userController.getShopItems);
router.post('/shop/buy', authMiddleware, userController.buyShopItem);

module.exports = router;
