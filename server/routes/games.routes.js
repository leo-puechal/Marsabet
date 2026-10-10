const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middlewares/authMiddleware');

// Toutes les requêtes de jeux exigent d'être authentifié
router.use(authMiddleware);

// Slots
router.post('/slots/spin', gameController.playSlots);

// Blackjack
router.get('/blackjack/state', gameController.getBlackjackState);
router.post('/blackjack/deal', gameController.dealBlackjack);
router.post('/blackjack/hit', gameController.hitBlackjack);
router.post('/blackjack/stand', gameController.standBlackjack);
router.post('/blackjack/double', gameController.doubleBlackjack);

// Roulette
router.post('/roulette/spin', gameController.playRoulette);

// Dice
router.post('/dice/roll', gameController.playDice);

// Wheel of Fortune
router.post('/wheel/spin', gameController.playWheel);

// Plinko
router.post('/plinko/drop', gameController.playPlinko);

// Free Daily Wheel
router.get('/free-wheel/status', gameController.getFreeWheelStatus);
router.post('/free-wheel/spin', gameController.spinFreeWheel);

module.exports = router;
