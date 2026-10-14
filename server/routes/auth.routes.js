const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerificationCode);
router.get('/me', authMiddleware, authController.getMe);
router.post('/daily-bonus', authMiddleware, authController.claimDailyBonus);
router.post('/become-admin', authMiddleware, authController.becomeAdmin);

module.exports = router;
