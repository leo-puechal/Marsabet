const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const config = require('../config/config');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    config.jwtSecret,
    { expiresIn: '30d' }
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

exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 20) {
      return res.status(400).json({ error: 'Le pseudo doit comporter entre 3 et 20 caractères.' });
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 4 caractères.' });
    }

    const cleanUsername = username.trim();

    // Vérifier si le pseudo existe déjà
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
    if (existing) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris, choisis-en un autre !' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insert = db.prepare(`
      INSERT INTO users (username, password_hash, coins, daily_streak, last_daily_claim)
      VALUES (?, ?, ?, 0, NULL)
    `);

    const result = insert.run(cleanUsername, passwordHash, config.startingCoins);

    const newUser = db.prepare(`
      SELECT id, username, coins, daily_streak, last_daily_claim, total_wagered, total_won, games_played, biggest_win, created_at
      FROM users WHERE id = ?
    `).get(result.lastInsertRowid);

    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Compte créé avec succès ! 1000 jetons de bienvenue offerts.',
      token,
      user: {
        ...newUser,
        canClaimDaily: true,
      }
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    return res.status(500).json({ error: 'Une erreur interne est survenue lors de la création du compte.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Pseudo et mot de passe requis.' });
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

    const token = generateToken(user);
    const today = getTodayString();
    const canClaimDaily = user.last_daily_claim !== today;

    const safeUser = {
      id: user.id,
      username: user.username,
      coins: user.coins,
      daily_streak: user.daily_streak,
      last_daily_claim: user.last_daily_claim,
      total_wagered: user.total_wagered,
      total_won: user.total_won,
      games_played: user.games_played,
      biggest_win: user.biggest_win,
      created_at: user.created_at,
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

exports.getMe = (req, res) => {
  const user = req.user;
  const today = getTodayString();
  const canClaimDaily = user.last_daily_claim !== today;

  return res.json({
    user: {
      ...user,
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

  return res.json({
    message: `Bonus quotidien réclamé : +${bonusAmount} jetons ! (Série : ${newStreak} jour${newStreak > 1 ? 's' : ''})`,
    bonusAmount,
    newStreak,
    coins: newCoins
  });
};
