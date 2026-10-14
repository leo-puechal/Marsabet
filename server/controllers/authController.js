const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const config = require('../config/config');
const vipService = require('../services/vipService');
const emailService = require('../services/emailService');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    const lastName = typeof (req.body.lastName || req.body.last_name) === 'string' ? (req.body.lastName || req.body.last_name).trim() : '';
    const firstName = typeof (req.body.firstName || req.body.first_name) === 'string' ? (req.body.firstName || req.body.first_name).trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!lastName || !firstName) {
      return res.status(400).json({ error: 'Le nom et le prénom sont obligatoires pour pouvoir récupérer tes récompenses physiques.' });
    }

    if (lastName.length > 50 || firstName.length > 50) {
      return res.status(400).json({ error: 'Le nom et le prénom ne doivent pas dépasser 50 caractères.' });
    }

    // Validation stricte de l'email étudiant Epitech (@epitech.eu)
    if (!email) {
      return res.status(400).json({ error: 'L\'adresse email étudiante Epitech (@epitech.eu) est obligatoire.' });
    }

    const epitechEmailRegex = /^[a-zA-Z0-9_.+-]+@([a-zA-Z0-9-]+\.)*epitech\.(eu|digital)$/i;
    if (!epitechEmailRegex.test(email)) {
      return res.status(400).json({ error: 'Format d\'email non autorisé. Tu dois obligatoirement utiliser ton adresse email étudiante officielle (@epitech.eu).' });
    }

    // Vérifier l'unicité de l'email
    const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Cette adresse email étudiante est déjà associée à un compte Marsabet.' });
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
      return res.status(400).json({ error: 'Le pseudo doit comporter entre 3 et 20 caractères.' });
    }

    const cleanUsername = username.trim();
    if (!/^[a-zA-Z0-9_\-\.]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Le pseudo ne peut contenir que des lettres, chiffres, points, tirets et underscores.' });
    }

    if (!password || typeof password !== 'string' || password.length < 4 || password.length > 128) {
      return res.status(400).json({ error: 'Le mot de passe doit comporter entre 4 et 128 caractères.' });
    }

    // Vérifier si le pseudo existe déjà
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris, choisis-en un autre !' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Stockage de l'adresse IP à l'inscription (pour enquête admin multi-comptes)
    const registrationIp = getClientIp(req);

    // Génération du code de vérification à 6 chiffres
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    const insert = db.prepare(`
      INSERT INTO users (username, password_hash, first_name, last_name, email, registration_ip, email_verified, verification_code, verification_expires, coins, daily_streak, last_daily_claim)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, NULL)
    `);

    insert.run(
      cleanUsername,
      passwordHash,
      firstName,
      lastName,
      email,
      registrationIp,
      verificationCode,
      verificationExpires,
      config.startingCoins
    );

    // Envoi du code par email
    await emailService.sendVerificationEmail(email, verificationCode, cleanUsername);

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      email,
      username: cleanUsername,
      message: `Un code de confirmation à 6 chiffres a été envoyé à ${email}. Saisis-le pour activer ton compte et recevoir tes ${config.startingCoins.toLocaleString('fr-FR')} jetons !`
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    if (error.message && error.message.includes('UNIQUE constraint failed: users.email')) {
      return res.status(409).json({ error: 'Cette adresse email est déjà associée à un compte Marsabet.' });
    }
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la création du compte.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Pseudo et mot de passe requis.' });
    }

    if (username.length > 50 || password.length > 128) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const cleanUsername = username.trim();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(cleanUsername);

    if (!user) {
      return res.status(401).json({ error: 'Identifiants invalides (pseudo inconnu).' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Identifiants invalides (mot de passe incorrect).' });
    }

    // Vérifier si le compte est activé via email
    if (user.email_verified === 0) {
      let code = user.verification_code;
      if (!code || !user.verification_expires || Date.now() > user.verification_expires) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = Date.now() + 15 * 60 * 1000;
        db.prepare('UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?').run(code, expires, user.id);
        emailService.sendVerificationEmail(user.email, code, user.username).catch(() => {});
      }
      return res.status(403).json({
        error: 'Ton compte n\'est pas encore activé. Saisis le code de validation envoyé à ton adresse email.',
        requiresVerification: true,
        email: user.email,
        username: user.username
      });
    }

    const token = generateToken(user);
    const today = getTodayString();
    const canClaimDaily = user.last_daily_claim !== today;

    const vipInfo = vipService.getVipInfo(user.total_wagered);

    const safeUser = {
      id: user.id,
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      role: user.role || 'student',
      coins: user.coins,
      daily_streak: user.daily_streak,
      last_daily_claim: user.last_daily_claim,
      last_free_spin: user.last_free_spin,
      free_spin_streak: user.free_spin_streak || 0,
      total_wagered: user.total_wagered,
      total_won: user.total_won,
      games_played: user.games_played,
      biggest_win: user.biggest_win,
      created_at: user.created_at,
      vipInfo,
      canClaimDaily
    };

    return res.json({
      message: 'Connexion réussie ! Bon retour sur Marsabet.',
      token,
      user: safeUser
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    return res.status(500).json({ error: 'Une erreur interne est survenue.' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : (req.body.code ? String(req.body.code).trim() : '');

    if (!code) {
      return res.status(400).json({ error: 'Code de vérification requis.' });
    }

    if (!email && !username) {
      return res.status(400).json({ error: 'Adresse email ou pseudo requis.' });
    }

    const user = email
      ? db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email)
      : db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    if (user.email_verified === 1) {
      const token = generateToken(user);
      const vipInfo = vipService.getVipInfo(user.total_wagered);
      return res.json({
        success: true,
        alreadyVerified: true,
        message: 'Ce compte est déjà activé !',
        token,
        user: { ...user, vipInfo, canClaimDaily: true }
      });
    }

    if (user.verification_code !== code) {
      return res.status(400).json({ error: 'Code de validation incorrect. Vérifie tes emails ou clique sur "Renvoyer".' });
    }

    if (user.verification_expires && Date.now() > user.verification_expires) {
      return res.status(400).json({ error: 'Ce code a expiré (validité 15 min). Clique sur "Renvoyer le code" pour en générer un nouveau.' });
    }

    // Activer le compte
    db.prepare('UPDATE users SET email_verified = 1, verification_code = NULL, verification_expires = NULL WHERE id = ?').run(user.id);

    const updatedUser = db.prepare('SELECT id, username, first_name, last_name, email, role, coins, daily_streak, last_daily_claim, total_wagered, total_won, games_played, biggest_win, created_at FROM users WHERE id = ?').get(user.id);

    const token = generateToken(updatedUser);
    const vipInfo = vipService.getVipInfo(updatedUser.total_wagered);

    return res.json({
      success: true,
      message: `Compte activé avec succès ! Bienvenue ${updatedUser.username}, tes ${config.startingCoins.toLocaleString('fr-FR')} jetons de bienvenue sont disponibles !`,
      token,
      user: {
        ...updatedUser,
        vipInfo,
        canClaimDaily: true
      }
    });
  } catch (err) {
    console.error('Erreur verifyEmail:', err);
    return res.status(500).json({ error: 'Erreur lors de la vérification de l\'email.' });
  }
};

exports.resendVerificationCode = async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';

    if (!email && !username) {
      return res.status(400).json({ error: 'Adresse email ou pseudo requis.' });
    }

    const user = email
      ? db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email)
      : db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    if (user.email_verified === 1) {
      return res.status(400).json({ error: 'Ce compte est déjà activé.' });
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000;

    db.prepare('UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?').run(newCode, expires, user.id);

    await emailService.sendVerificationEmail(user.email, newCode, user.username);

    return res.json({
      success: true,
      message: `Un nouveau code de validation a été envoyé à ${user.email}.`
    });
  } catch (err) {
    console.error('Erreur resendVerificationCode:', err);
    return res.status(500).json({ error: 'Erreur lors du renvoi du code.' });
  }
};

exports.getMe = (req, res) => {
  const user = req.user;
  const today = getTodayString();
  const canClaimDaily = user.last_daily_claim !== today;
  const vipInfo = vipService.getVipInfo(user.total_wagered);

  return res.json({
    user: {
      ...user,
      vipInfo,
      canClaimDaily
    }
  });
};

exports.claimDailyBonus = (req, res) => {
  const userId = req.user.id;
  const today = getTodayString();
  const yesterday = getYesterdayString();

  const user = db.prepare('SELECT id, coins, daily_streak, last_daily_claim FROM users WHERE id = ?').get(userId);

  if (user.last_daily_claim === today) {
    return res.status(400).json({
      error: 'Tu as déjà récupéré ton bonus aujourd’hui ! Reviens demain.',
      streak: user.daily_streak
    });
  }

  // Calcul du streak
  let newStreak = 1;
  if (user.last_daily_claim === yesterday) {
    newStreak = Math.min(user.daily_streak + 1, config.maxStreakBonusDays);
  }

  // Calcul du montant du bonus (100 de base + (streak - 1) * 25)
  const bonusAmount = config.dailyBonusBase + ((newStreak - 1) * config.dailyBonusStreakMultiplier);
  const newCoins = user.coins + bonusAmount;

  const update = db.prepare(`
    UPDATE users 
    SET coins = ?, daily_streak = ?, last_daily_claim = ?
    WHERE id = ?
  `);

  update.run(newCoins, newStreak, today, userId);

  // Enregistrer dans l'historique
  db.prepare(`
    INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
    VALUES (?, 'daily_bonus', 0, ?, ?, ?)
  `).run(userId, bonusAmount, bonusAmount, JSON.stringify({ streak: newStreak, day: today }));

  try {
    const socketService = require('../services/socketService');
    socketService.notifyUserBalance(userId, newCoins, { daily_streak: newStreak });
    socketService.notifyLeaderboardUpdated();
  } catch (sockErr) {}

  return res.json({
    message: `Bonus quotidien réclamé : +${bonusAmount} jetons ! (Série : ${newStreak} jour${newStreak > 1 ? 's' : ''})`,
    bonusAmount,
    newStreak,
    coins: newCoins
  });
};

const failedAdminAttempts = new Map();

exports.becomeAdmin = (req, res) => {
  const userId = req.user.id;
  const now = Date.now();

  const attempt = failedAdminAttempts.get(userId) || { count: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > now) {
    const remainingMin = Math.ceil((attempt.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Trop de tentatives erronées. Accès verrouillé pour ${remainingMin} minute(s).` });
  }

  const { secretKey } = req.body;
  if (!secretKey || typeof secretKey !== 'string' || secretKey.length > 100) {
    return res.status(400).json({ error: 'Code administrateur invalide.' });
  }
  const adminSecret = process.env.ADMIN_SECRET_KEY || config.adminSecretKey || 'darkrider84';

  if (secretKey.trim() !== adminSecret.trim()) {
    attempt.count += 1;
    if (attempt.count >= 3) {
      attempt.lockedUntil = now + (15 * 60 * 1000); // 15 min lock
      failedAdminAttempts.set(userId, attempt);
      return res.status(429).json({ error: 'Trop de tentatives erronées. Accès temporairement bloqué pendant 15 minutes.' });
    }
    failedAdminAttempts.set(userId, attempt);
    return res.status(403).json({ error: 'Code administrateur incorrect.' });
  }

  // Succès : réinitialiser les tentatives
  failedAdminAttempts.delete(userId);
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.user.id);
  const updatedUser = db.prepare('SELECT id, username, role, coins FROM users WHERE id = ?').get(req.user.id);

  return res.json({
    message: 'Félicitations ! Tu es désormais Administrateur BDE.',
    user: updatedUser
  });
};
