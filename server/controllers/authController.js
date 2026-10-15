const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken } = require('../utils/token');
const db = require('../database/db');
const config = require('../config/config');
const vipService = require('../services/vipService');
const emailService = require('../services/emailService');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

function generateToken(user) {
  return signToken(user);
}

// Code de vérification à 6 chiffres généré avec un CSPRNG (Math.random est prédictible)
function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Suivi mémoire des essais de validation (par compte) et des renvois de code
const verifyAttempts = new Map();
const lastResendAt = new Map();

function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0]; // Format 'YYYY-MM-DD'
}

function getYesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// L'IP vient de req.ip : Express ne lit X-Forwarded-For que si 'trust proxy' est configuré (TRUST_PROXY).
// Lire l'en-tête directement permettrait à n'importe quel client de se faire passer pour une autre IP.
function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;
    const lastName = typeof (req.body.lastName || req.body.last_name) === 'string' ? (req.body.lastName || req.body.last_name).trim() : '';
    const firstName = typeof (req.body.firstName || req.body.first_name) === 'string' ? (req.body.firstName || req.body.first_name).trim() : '';
    let email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

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

    const epitechEmailRegex = /^[a-zA-Z0-9_.+-]{1,64}@epitech\.(eu|digital)$/i;
    if (email.length > 100 || !epitechEmailRegex.test(email)) {
      return res.status(400).json({ error: 'Format d\'email non autorisé. Tu dois obligatoirement utiliser ton adresse email étudiante officielle (@epitech.eu).' });
    }

    // Forme canonique : "prenom.nom+x@epitech.eu" et "prenom.nom@epitech.eu" désignent la même boîte
    email = email.replace(/\+[^@]*@/, '@');

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

    if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return res.status(400).json({ error: `Le mot de passe doit comporter entre ${MIN_PASSWORD_LENGTH} et 128 caractères.` });
    }

    // Vérifier si le pseudo existe déjà
    const existing = db.prepare('SELECT id, email, email_verified FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      if (existing.email_verified === 0) {
        // L'élève a fait une faute de frappe dans son email et recommence avec le même pseudo :
        // On met à jour son email et on lui renvoie le code d'activation !
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const registrationIp = getClientIp(req);
        const verificationCode = generateVerificationCode();
        const verificationExpires = Date.now() + CODE_TTL_MS;
        verifyAttempts.delete(existing.id);

        db.prepare(`
          UPDATE users
          SET password_hash = ?, first_name = ?, last_name = ?, email = ?, registration_ip = ?, verification_code = ?, verification_expires = ?
          WHERE id = ?
        `).run(passwordHash, firstName, lastName, email, registrationIp, verificationCode, verificationExpires, existing.id);

        await emailService.sendVerificationEmail(email, verificationCode, cleanUsername);

        return res.status(201).json({
          success: true,
          requiresVerification: true,
          email,
          username: cleanUsername,
          message: `Adresse email corrigée avec succès ! Un nouveau code de validation a été envoyé à ${email}.`
        });
      }
      return res.status(409).json({ error: 'Ce pseudo est déjà pris, choisis-en un autre !' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Stockage de l'adresse IP à l'inscription (pour enquête admin multi-comptes)
    const registrationIp = getClientIp(req);

    // Génération du code de vérification à 6 chiffres
    const verificationCode = generateVerificationCode();
    const verificationExpires = Date.now() + CODE_TTL_MS; // 15 minutes

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

const failedLoginAttempts = new Map();
const DUMMY_HASH = bcrypt.hashSync('marsabet-dummy-password', BCRYPT_ROUNDS);

// Purge périodique des compteurs expirés (évite la croissance infinie des Map)
setInterval(() => {
  const t = Date.now();
  for (const [key, val] of failedLoginAttempts) {
    if (val.lockedUntil < t && !val.count) failedLoginAttempts.delete(key);
  }
  for (const [key, val] of lastResendAt) {
    if (t - val > RESEND_COOLDOWN_MS) lastResendAt.delete(key);
  }
}, 10 * 60 * 1000).unref();

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = getClientIp(req);
    const now = Date.now();

    const attempt = failedLoginAttempts.get(clientIp) || { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > now) {
      const remainingSec = Math.ceil((attempt.lockedUntil - now) / 1000);
      return res.status(429).json({
        error: `Trop de tentatives erronées (3/3). Veuillez patienter ${remainingSec} seconde${remainingSec > 1 ? 's' : ''} avant de réessayer.`
      });
    }

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Pseudo ou email et mot de passe requis.' });
    }

    if (username.length > 80 || password.length > 128) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const cleanIdentifier = username.trim();
    // Permet de se connecter soit avec son pseudo, soit directement avec son email étudiant Epitech
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR LOWER(email) = LOWER(?)').get(cleanIdentifier, cleanIdentifier);

    const onLoginFailed = (errorDetail) => {
      attempt.count = (attempt.count || 0) + 1;
      const remainingTries = Math.max(0, 3 - attempt.count);

      if (attempt.count >= 3) {
        attempt.lockedUntil = now + (60 * 1000); // 1 minute de pause seulement (au lieu de 15 minutes)
        attempt.count = 0; // Réinitialisé pour le prochain cycle
        failedLoginAttempts.set(clientIp, attempt);
        return res.status(429).json({
          error: '3 tentatives infructueuses consécutives. Accès temporairement suspendu pour 1 minute.'
        });
      }

      failedLoginAttempts.set(clientIp, attempt);
      return res.status(401).json({
        error: `${errorDetail} Il te reste ${remainingTries} essai${remainingTries > 1 ? 's' : ''} avant verrouillage.`
      });
    };

    // Message identique que le compte existe ou non (anti-énumération), et bcrypt toujours exécuté
    // pour ne pas révéler l'existence d'un compte par le temps de réponse.
    const match = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !match) {
      return onLoginFailed('Identifiants invalides.');
    }

    // Succès de l'authentification : suppression du compteur d'échecs
    failedLoginAttempts.delete(clientIp);

    // Vérifier si le compte est activé via email
    if (user.email_verified === 0) {
      let code = user.verification_code;
      if (!code || !user.verification_expires || Date.now() > user.verification_expires) {
        code = generateVerificationCode();
        const expires = Date.now() + CODE_TTL_MS;
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
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : (typeof req.body.code === 'number' ? String(req.body.code) : '');

    if (!code || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Code de vérification invalide (6 chiffres attendus).' });
    }

    if (!email && !username) {
      return res.status(400).json({ error: 'Adresse email ou pseudo requis.' });
    }

    const user = email
      ? db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email)
      : db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    const invalid = () => res.status(400).json({ error: 'Code de validation incorrect ou expiré. Vérifie tes emails ou clique sur "Renvoyer".' });

    // Un compte déjà activé n'est JAMAIS connecté par cette route : sinon connaître l'email ou le pseudo
    // d'un joueur suffirait à obtenir un jeton de session à sa place.
    if (!user || user.email_verified === 1) {
      return invalid();
    }

    // Anti brute-force du code à 6 chiffres : 5 essais max, puis le code est invalidé
    const attempts = (verifyAttempts.get(user.id) || 0) + 1;
    if (attempts > MAX_VERIFY_ATTEMPTS) {
      db.prepare('UPDATE users SET verification_code = NULL, verification_expires = NULL WHERE id = ?').run(user.id);
      verifyAttempts.delete(user.id);
      return res.status(429).json({ error: 'Trop d\'essais. Ce code est annulé : clique sur "Renvoyer le code" pour en recevoir un nouveau.' });
    }
    verifyAttempts.set(user.id, attempts);

    if (!user.verification_code || !user.verification_expires || Date.now() > user.verification_expires) {
      return invalid();
    }

    if (!safeEqual(user.verification_code, code)) {
      return invalid();
    }

    verifyAttempts.delete(user.id);

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

    // Réponse neutre : ne révèle ni l'existence ni l'état d'un compte
    const neutral = { success: true, message: 'Si un compte en attente d\'activation correspond, un nouveau code vient d\'être envoyé.' };

    if (!user || user.email_verified === 1) {
      return res.json(neutral);
    }

    // Anti-spam d'emails : 1 renvoi par minute et par compte
    const last = lastResendAt.get(user.id) || 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) {
      return res.status(429).json({ error: 'Patiente environ une minute avant de demander un nouveau code.' });
    }
    lastResendAt.set(user.id, Date.now());

    const newCode = generateVerificationCode();
    const expires = Date.now() + CODE_TTL_MS;

    db.prepare('UPDATE users SET verification_code = ?, verification_expires = ? WHERE id = ?').run(newCode, expires, user.id);
    verifyAttempts.delete(user.id);

    await emailService.sendVerificationEmail(user.email, newCode, user.username);

    return res.json(neutral);
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

  // Pas de clé configurée côté serveur = promotion par code désactivée (jamais de clé par défaut)
  const adminSecret = config.adminSecretKey;
  if (!adminSecret || adminSecret.trim().length < 12) {
    return res.status(403).json({ error: 'La promotion par code administrateur est désactivée sur ce serveur.' });
  }

  const attempt = failedAdminAttempts.get(userId) || { count: 0, lockedUntil: 0 };
  if (attempt.lockedUntil > now) {
    const remainingMin = Math.ceil((attempt.lockedUntil - now) / 60000);
    return res.status(429).json({ error: `Trop de tentatives erronées. Accès verrouillé pour ${remainingMin} minute(s).` });
  }

  const { secretKey } = req.body;
  if (!secretKey || typeof secretKey !== 'string' || secretKey.length > 100) {
    return res.status(400).json({ error: 'Code administrateur invalide.' });
  }

  if (!safeEqual(secretKey.trim(), adminSecret.trim())) {
    attempt.count += 1;
    if (attempt.count >= 3) {
      attempt.count = 0;
      attempt.lockedUntil = now + (15 * 60 * 1000); // 15 min lock
      failedAdminAttempts.set(userId, attempt);
      console.warn(`[SECURITY] Tentatives de promotion admin échouées pour l'utilisateur #${userId} (IP ${getClientIp(req)})`);
      return res.status(429).json({ error: 'Trop de tentatives erronées. Accès temporairement bloqué pendant 15 minutes.' });
    }
    failedAdminAttempts.set(userId, attempt);
    return res.status(403).json({ error: 'Code administrateur incorrect.' });
  }

  // Succès : réinitialiser les tentatives
  failedAdminAttempts.delete(userId);
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.user.id);
  console.warn(`[SECURITY] Utilisateur #${userId} (${req.user.username}) promu administrateur via le code secret.`);
  const updatedUser = db.prepare('SELECT id, username, role, coins FROM users WHERE id = ?').get(req.user.id);

  return res.json({
    message: 'Félicitations ! Tu es désormais Administrateur BDE.',
    user: updatedUser
  });
};
