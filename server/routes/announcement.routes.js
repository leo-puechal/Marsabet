const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const authMiddleware = require('../middlewares/authMiddleware');

// Toutes les interactions d'annonces élève nécessitent une session authentifiée
router.use(authMiddleware);

// Récupérer les annonces non vues (ordre chronologique de création)
router.get('/unread', announcementController.getUnreadAnnouncements);

// Acquitter la vue d'une annonce
router.post('/:id/view', announcementController.markAnnouncementViewed);

module.exports = router;
