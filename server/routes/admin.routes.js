const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Toutes les routes admin nécessitent authentification + rôle admin
router.use(authMiddleware);
router.use(adminMiddleware);

// Validation des retraits au stand
router.get('/claims/check', adminController.checkClaimCode);
router.post('/claims/validate', adminController.validateClaimCode);

// Historique de tous les échanges
router.get('/orders', adminController.getAllOrders);

// Gestion du catalogue et stocks
router.get('/products', adminController.getProductsAdmin);
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct);
router.delete('/products/:id', adminController.deleteProduct);

module.exports = router;
