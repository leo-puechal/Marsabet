const contestService = require('../services/contestService');
const { verifyToken } = require('../utils/token');

// Helper pour extraire l'utilisateur optionnel
function getOptionalUserId(req) {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) return null;
    const decoded = verifyToken(token);
    return decoded ? decoded.id : null;
  } catch (e) {
    return null;
  }
}

exports.getContests = (req, res) => {
  try {
    const userId = req.user ? req.user.id : getOptionalUserId(req);
    const includeEnded = req.query.includeEnded === 'true';
    const contests = contestService.getAllContests(includeEnded, userId);
    return res.json({ contests });
  } catch (err) {
    console.error('Erreur getContests:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des concours.' });
  }
};

exports.getContest = (req, res) => {
  try {
    const contestId = parseInt(req.params.id, 10);
    if (isNaN(contestId)) {
      return res.status(400).json({ error: 'ID de concours invalide.' });
    }
    const userId = req.user ? req.user.id : getOptionalUserId(req);
    const contest = contestService.getContestDetails(contestId, userId);
    if (!contest) {
      return res.status(404).json({ error: 'Concours introuvable.' });
    }
    return res.json({ contest });
  } catch (err) {
    console.error('Erreur getContest:', err);
    return res.status(500).json({ error: 'Impossible de récupérer les détails du concours.' });
  }
};

exports.createContest = (req, res) => {
  try {
    const adminId = req.user.id;
    const {
      title,
      description,
      gameType,
      criterion,
      minBet,
      prizePool,
      prizeDistribution,
      startDate,
      endDate
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Le titre du concours est obligatoire.' });
    }

    const contestId = contestService.createContest({
      title,
      description,
      gameType,
      criterion,
      minBet,
      prizePool,
      prizeDistribution,
      startDate,
      endDate
    }, adminId);

    return res.status(201).json({
      success: true,
      contestId,
      message: 'Concours créé avec succès !'
    });
  } catch (err) {
    console.error('Erreur createContest:', err);
    return res.status(400).json({ error: err.message || 'Impossible de créer le concours.' });
  }
};

exports.distributePrizes = (req, res) => {
  try {
    const contestId = parseInt(req.params.id, 10);
    if (isNaN(contestId)) {
      return res.status(400).json({ error: 'ID de concours invalide.' });
    }
    const adminId = req.user.id;
    const result = contestService.distributePrizes(contestId, adminId);
    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Erreur distributePrizes:', err);
    return res.status(400).json({ error: err.message || 'Impossible de distribuer les récompenses.' });
  }
};

exports.deleteContest = (req, res) => {
  try {
    const contestId = parseInt(req.params.id, 10);
    if (isNaN(contestId)) {
      return res.status(400).json({ error: 'ID de concours invalide.' });
    }
    contestService.deleteContest(contestId);
    return res.json({
      success: true,
      message: 'Concours supprimé avec succès.'
    });
  } catch (err) {
    console.error('Erreur deleteContest:', err);
    return res.status(400).json({ error: err.message || 'Impossible de supprimer le concours.' });
  }
};
