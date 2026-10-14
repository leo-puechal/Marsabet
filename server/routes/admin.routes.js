const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const announcementController = require('../controllers/announcementController');
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

// Gestion des utilisateurs (comptes, solde, rôles, suppression)
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/coins', adminController.updateUserCoins);
router.patch('/users/:id/role', adminController.updateUserRole);
router.patch('/users/:id/identity', adminController.updateUserIdentity);
router.delete('/users/:id', adminController.deleteUser);

// Annonces officielles BDE
router.get('/announcements', announcementController.adminGetAnnouncements);
router.post('/announcements', announcementController.adminCreateAnnouncement);
router.put('/announcements/:id', announcementController.adminUpdateAnnouncement);
router.patch('/announcements/:id/toggle', announcementController.adminToggleAnnouncement);
router.delete('/announcements/:id', announcementController.adminDeleteAnnouncement);

module.exports = router;
