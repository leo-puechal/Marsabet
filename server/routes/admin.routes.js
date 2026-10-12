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


// Codes promo BDE
router.get('/promo-codes', adminController.getPromoCodes);
router.post('/promo-codes', adminController.createPromoCode);
router.patch('/promo-codes/:id/toggle', adminController.togglePromoCode);
router.delete('/promo-codes/:id', adminController.deletePromoCode);

// Configuration et récompenses des Roues de la Fortune BDE
router.get('/wheels', adminController.getWheelsAdmin);
router.put('/wheels/:id/segments', adminController.updateWheelSegments);

module.exports = router;
