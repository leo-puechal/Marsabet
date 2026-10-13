const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');
const authMiddleware = require('../middlewares/authMiddleware');

// Toutes les requêtes de jeux exigent d'être authentifié
router.use(authMiddleware);

// Slots
router.get('/slots/state', gameController.getSlotsState);
router.post('/slots/spin', gameController.playSlots);
router.post('/slots/gamble', gameController.gambleSlots);
router.post('/slots/collect', gameController.collectSlotsGamble);

// Blackjack
router.get('/blackjack/state', gameController.getBlackjackState);
router.post('/blackjack/deal', gameController.dealBlackjack);
router.post('/blackjack/hit', gameController.hitBlackjack);
router.post('/blackjack/stand', gameController.standBlackjack);
router.post('/blackjack/double', gameController.doubleBlackjack);
router.post('/blackjack/split', gameController.splitBlackjack);

// Roulette
router.post('/roulette/spin', gameController.playRoulette);

// Dice
router.post('/dice/roll', gameController.playDice);

// Wheel of Fortune
router.post('/wheel/spin', gameController.playWheel);

// Plinko
router.post('/plinko/drop', gameController.playPlinko);

// Slider
router.post('/slider/play', gameController.playSlider);

// Crash
router.get('/crash/history', gameController.getCrashHistory);
router.post('/crash/play', gameController.startCrash);
router.post('/crash/start', gameController.startCrash);
router.post('/crash/cashout', gameController.cashoutCrash);
router.post('/crash/finish', gameController.finishCrash);

// Free Daily Wheel
router.get('/free-wheel/status', gameController.getFreeWheelStatus);
router.post('/free-wheel/spin', gameController.spinFreeWheel);

// Video Poker (Jacks or Better)
const videoPokerController = require('../controllers/videoPokerController');
router.get('/video-poker/state', videoPokerController.getState);
router.post('/video-poker/deal', videoPokerController.deal);
router.post('/video-poker/draw', videoPokerController.draw);

// Dragon Tower
const dragonTowerController = require('../controllers/dragonTowerController');
router.get('/dragon-tower/state', dragonTowerController.getState);
router.post('/dragon-tower/start', dragonTowerController.start);
router.post('/dragon-tower/step', dragonTowerController.step);
router.post('/dragon-tower/cashout', dragonTowerController.cashout);

module.exports = router;
