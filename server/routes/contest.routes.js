const express = require('express');
const router = express.Router();
const contestController = require('../controllers/contestController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');

// Routes publiques (avec utilisateur optionnel)
router.get('/', contestController.getContests);
router.get('/:id', contestController.getContest);

// Routes d'administration BDE
router.post('/', authMiddleware, adminMiddleware, contestController.createContest);
router.post('/:id/distribute', authMiddleware, adminMiddleware, contestController.distributePrizes);
router.delete('/:id', authMiddleware, adminMiddleware, contestController.deleteContest);

module.exports = router;
