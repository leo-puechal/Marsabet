const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Toutes les routes admin nécessitent authentification + rôle admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Demandes de livraison directe au BDE
router.get('/deliveries', adminController.getAllDeliveries);
router.patch('/deliveries/:id/deliver', adminController.markDelivered);
router.get('/orders', adminController.getAllDeliveries);

// Gestion du catalogue et stocks
router.get('/products', adminController.getProductsAdmin);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

// Codes promo BDE
router.get('/promo-codes', adminController.getPromoCodes);
router.post('/promo-codes', adminController.createPromoCode);
router.patch('/promo-codes/:id/toggle', adminController.togglePromoCode);
router.delete('/promo-codes/:id', adminController.deletePromoCode);

module.exports = router;
