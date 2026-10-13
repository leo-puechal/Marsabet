const db = require('../database/db');
const socketService = require('./socketService');

/**
 * Service de Gestion des Concours & Tournois Marsabet
 */
const contestService = {
  /**
   * Enregistre l'impact d'une partie jouée sur les concours actifs correspondants
   */
  recordGameProgress(userId, gameType, bet, payout, details = {}) {
    try {
      const now = new Date().toISOString();

      // Récupérer les concours actifs pour ce jeu (ou pour tous les jeux)
      const activeContests = db.prepare(`
        SELECT * FROM contests
        WHERE status = 'active'
          AND (game_type = ? OR game_type = 'all')
          AND (start_date IS NULL OR datetime(start_date) <= datetime('now'))
          AND (end_date IS NULL OR datetime(end_date) >= datetime('now'))
      `).all(gameType);

      if (!activeContests || activeContests.length === 0) return;

      const runTx = db.transaction(() => {
        for (const contest of activeContests) {
          // Vérification de la mise minimale requise pour qualifier la partie
          if (contest.min_bet && bet < contest.min_bet) {
            continue;
          }

          // Calcul des métriques de la partie
          let multiplier = 0;
          if (details && typeof details.multiplier === 'number' && !isNaN(details.multiplier)) {
            multiplier = parseFloat(details.multiplier.toFixed(2));
          } else if (bet > 0 && payout > 0) {
            multiplier = parseFloat((payout / bet).toFixed(2));
          }

          const win = Math.max(0, parseInt(payout, 10) || 0);
          const profit = win - (parseInt(bet, 10) || 0);
          const isWin = profit > 0 || (details && details.isWin === true);

          // Récupérer la participation existante du joueur
          const participant = db.prepare(`
            SELECT * FROM contest_participants
            WHERE contest_id = ? AND user_id = ?
          `).get(contest.id, userId);

          let bestMultiplier = multiplier;
          let bestWin = win;
          let totalProfit = Math.max(0, profit);
          let totalWins = isWin ? 1 : 0;
          let totalWagered = bet;
          let gamesPlayed = 1;

          if (participant) {
            bestMultiplier = Math.max(participant.best_multiplier, multiplier);
            bestWin = Math.max(participant.best_win, win);
            totalProfit = participant.total_profit + Math.max(0, profit);
            totalWins = participant.total_wins + (isWin ? 1 : 0);
            totalWagered = participant.total_wagered + bet;
            gamesPlayed = participant.games_played + 1;
          }

          // Détermination du score selon le critère du concours
          let score = 0;
          switch (contest.criterion) {
            case 'highest_multiplier':
              score = bestMultiplier;
              break;
            case 'highest_win':
              score = bestWin;
              break;
            case 'total_profit':
              score = totalProfit;
              break;
            case 'total_wins':
              score = totalWins;
              break;
            case 'total_wagered':
              score = totalWagered;
              break;
            default:
              score = bestMultiplier;
          }

          // Insertion ou mise à jour
          if (participant) {
            db.prepare(`
              UPDATE contest_participants
              SET score = ?,
                  best_multiplier = ?,
                  best_win = ?,
                  total_profit = ?,
                  total_wins = ?,
                  total_wagered = ?,
                  games_played = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              score,
              bestMultiplier,
              bestWin,
              totalProfit,
              totalWins,
              totalWagered,
              gamesPlayed,
              participant.id
            );
          } else {
            db.prepare(`
              INSERT INTO contest_participants (
                contest_id, user_id, score, best_multiplier, best_win,
                total_profit, total_wins, total_wagered, games_played
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              contest.id,
              userId,
              score,
              bestMultiplier,
              bestWin,
              totalProfit,
              totalWins,
              totalWagered,
              gamesPlayed
            );
          }
        }
      });

      runTx();

      // Diffusion temps réel de la mise à jour des classements de concours
      try {
        const io = socketService.getIO();
        if (io) {
          io.emit('contest:updated');
        }
      } catch (e) {}

    } catch (err) {
      console.error('Erreur contestService.recordGameProgress:', err);
    }
  },

  /**
   * Récupère la liste de tous les concours
   */
  getAllContests(includeEnded = true, currentUserId = null) {
    try {
      let query = `SELECT * FROM contests`;
      if (!includeEnded) {
        query += ` WHERE status = 'active'`;
      }
      query += ` ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at DESC`;

      const contests = db.prepare(query).all();

      return contests.map(c => {
        // Participants count
        const countRes = db.prepare(`
          SELECT COUNT(*) as count FROM contest_participants WHERE contest_id = ?
        `).get(c.id);
        const participantsCount = countRes ? countRes.count : 0;

        // Top 3 Podium
        const top3 = db.prepare(`
          SELECT cp.score, cp.user_id, u.username, u.role, u.vip_rank
          FROM contest_participants cp
          JOIN users u ON cp.user_id = u.id
          WHERE cp.contest_id = ? AND cp.score > 0
          ORDER BY cp.score DESC
          LIMIT 3
        `).all(c.id).map((p, idx) => ({
          rank: idx + 1,
          userId: p.user_id,
          username: p.username,
          vipRank: p.vip_rank || 'BRONZE',
          score: p.score
        }));

        // Rang et score du joueur actuel s'il est connecté
        let myEntry = null;
        if (currentUserId) {
          const myParticipant = db.prepare(`
            SELECT * FROM contest_participants WHERE contest_id = ? AND user_id = ?
          `).get(c.id, currentUserId);

          if (myParticipant) {
            const rankRes = db.prepare(`
              SELECT COUNT(*) as rankHigher
              FROM contest_participants
              WHERE contest_id = ? AND score > ?
            `).get(c.id, myParticipant.score);

            myEntry = {
              score: myParticipant.score,
              gamesPlayed: myParticipant.games_played,
              bestMultiplier: myParticipant.best_multiplier,
              bestWin: myParticipant.best_win,
              totalProfit: myParticipant.total_profit,
              rank: (rankRes ? rankRes.rankHigher : 0) + 1
            };
          }
        }

        // Calcul du temps restant
        let timeRemainingMs = null;
        if (c.end_date) {
          const diff = new Date(c.end_date).getTime() - Date.now();
          timeRemainingMs = Math.max(0, diff);
        }

        let prizeDistribution = { first: 50, second: 30, third: 20 };
        try {
          if (c.prize_distribution) {
            prizeDistribution = JSON.parse(c.prize_distribution);
          }
        } catch (e) {}

        const firstPrize = Math.floor(c.prize_pool * (prizeDistribution.first || 50) / 100);
        const secondPrize = Math.floor(c.prize_pool * (prizeDistribution.second || 30) / 100);
        const thirdPrize = Math.floor(c.prize_pool * (prizeDistribution.third || 20) / 100);

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          gameType: c.game_type,
          criterion: c.criterion,
          minBet: c.min_bet,
          prizePool: c.prize_pool,
          prizes: {
            first: firstPrize,
            second: secondPrize,
            third: thirdPrize
          },
          startDate: c.start_date,
          endDate: c.end_date,
          status: c.status,
          prizesDistributed: c.prizes_distributed === 1,
          participantsCount,
          top3,
          myEntry,
          timeRemainingMs
        };
      });
    } catch (err) {
      console.error('Erreur getAllContests:', err);
      return [];
    }
  },

  /**
   * Détails complets et classement d'un concours
   */
  getContestDetails(contestId, currentUserId = null) {
    try {
      const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
      if (!contest) return null;

      // Classement complet (top 50)
      const leaderboard = db.prepare(`
        SELECT cp.*, u.username, u.vip_rank, u.role
        FROM contest_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.contest_id = ? AND cp.score > 0
        ORDER BY cp.score DESC
        LIMIT 50
      `).all(contestId).map((row, idx) => ({
        rank: idx + 1,
        userId: row.user_id,
        username: row.username,
        vipRank: row.vip_rank || 'BRONZE',
        role: row.role,
        score: row.score,
        bestMultiplier: row.best_multiplier,
        bestWin: row.best_win,
        totalProfit: row.total_profit,
        gamesPlayed: row.games_played,
        updatedAt: row.updated_at
      }));

      // Mon rang
      let myEntry = null;
      if (currentUserId) {
        const myP = db.prepare(`
          SELECT * FROM contest_participants WHERE contest_id = ? AND user_id = ?
        `).get(contestId, currentUserId);

        if (myP) {
          const rankRes = db.prepare(`
            SELECT COUNT(*) as rankHigher
            FROM contest_participants
            WHERE contest_id = ? AND score > ?
          `).get(contestId, myP.score);

          myEntry = {
            score: myP.score,
            rank: (rankRes ? rankRes.rankHigher : 0) + 1,
            bestMultiplier: myP.best_multiplier,
            bestWin: myP.best_win,
            totalProfit: myP.total_profit,
            gamesPlayed: myP.games_played
          };
        }
      }

      let prizeDistribution = { first: 50, second: 30, third: 20 };
      try {
        if (contest.prize_distribution) {
          prizeDistribution = JSON.parse(contest.prize_distribution);
        }
      } catch (e) {}

      const firstPrize = Math.floor(contest.prize_pool * (prizeDistribution.first || 50) / 100);
      const secondPrize = Math.floor(contest.prize_pool * (prizeDistribution.second || 30) / 100);
      const thirdPrize = Math.floor(contest.prize_pool * (prizeDistribution.third || 20) / 100);

      return {
        id: contest.id,
        title: contest.title,
        description: contest.description,
        gameType: contest.game_type,
        criterion: contest.criterion,
        minBet: contest.min_bet,
        prizePool: contest.prize_pool,
        prizes: {
          first: firstPrize,
          second: secondPrize,
          third: thirdPrize
        },
        startDate: contest.start_date,
        endDate: contest.end_date,
        status: contest.status,
        prizesDistributed: contest.prizes_distributed === 1,
        leaderboard,
        myEntry
      };
    } catch (err) {
      console.error('Erreur getContestDetails:', err);
      return null;
    }
  },

  /**
   * Création d'un nouveau concours par l'admin
   */
  createContest(data, adminId) {
    const {
      title,
      description,
      gameType = 'all',
      criterion = 'highest_multiplier',
      minBet = 10,
      prizePool = 10000,
      prizeDistribution = { first: 50, second: 30, third: 20 },
      startDate = new Date().toISOString(),
      endDate
    } = data;

    if (!title || !title.trim()) {
      throw new Error('Le titre du concours est obligatoire.');
    }

    const res = db.prepare(`
      INSERT INTO contests (
        title, description, game_type, criterion, min_bet, prize_pool,
        prize_distribution, start_date, end_date, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      title.trim(),
      description ? description.trim() : '',
      gameType,
      criterion,
      parseInt(minBet, 10) || 10,
      parseInt(prizePool, 10) || 10000,
      JSON.stringify(prizeDistribution),
      startDate,
      endDate || null,
      adminId
    );

    try {
      const io = socketService.getIO();
      if (io) {
        io.emit('contest:created', { id: res.lastInsertRowid, title });
      }
    } catch (e) {}

    return res.lastInsertRowid;
  },

  /**
   * Distribuer les récompenses aux 3 premiers gagnants
   */
  distributePrizes(contestId, adminId) {
    const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(contestId);
    if (!contest) {
      throw new Error('Concours introuvable.');
    }

    if (contest.prizes_distributed === 1) {
      throw new Error('Les récompenses de ce concours ont déjà été distribuées.');
    }

    // Récupérer le top 3 des participants
    const winners = db.prepare(`
      SELECT cp.user_id, cp.score, u.username, u.coins
      FROM contest_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.contest_id = ? AND cp.score > 0
      ORDER BY cp.score DESC
      LIMIT 3
    `).all(contestId);

    if (winners.length === 0) {
      // Aucun participant avec score > 0 : clôturer simplement
      db.prepare("UPDATE contests SET status = 'ended', prizes_distributed = 1 WHERE id = ?").run(contestId);
      return { awarded: 0, message: 'Aucun gagnant qualifié. Le concours a été clôturé.' };
    }

    let prizeDist = { first: 50, second: 30, third: 20 };
    try {
      if (contest.prize_distribution) prizeDist = JSON.parse(contest.prize_distribution);
    } catch (e) {}

    const shares = [prizeDist.first || 50, prizeDist.second || 30, prizeDist.third || 20];
    const results = [];

    const runTx = db.transaction(() => {
      winners.forEach((winner, idx) => {
        const percentage = shares[idx] || 0;
        const rewardCoins = Math.floor(contest.prize_pool * percentage / 100);

        if (rewardCoins > 0) {
          // Créditer les pièces
          db.prepare(`
            UPDATE users
            SET coins = coins + ?,
                total_won = total_won + ?
            WHERE id = ?
          `).run(rewardCoins, rewardCoins, winner.user_id);

          // Enregistrer dans l'historique
          db.prepare(`
            INSERT INTO game_history (user_id, game_type, bet, payout, profit, details)
            VALUES (?, 'contest_reward', 0, ?, ?, ?)
          `).run(
            winner.user_id,
            rewardCoins,
            rewardCoins,
            JSON.stringify({
              contestId: contest.id,
              contestTitle: contest.title,
              rank: idx + 1,
              score: winner.score
            })
          );

          results.push({
            rank: idx + 1,
            userId: winner.user_id,
            username: winner.username,
            rewardCoins
          });

          // Notifier l'utilisateur
          const updatedUser = db.prepare('SELECT coins FROM users WHERE id = ?').get(winner.user_id);
          if (updatedUser) {
            socketService.notifyUserBalance(winner.user_id, updatedUser.coins);
          }
        }
      });

      // Mettre à jour le statut du concours
      db.prepare(`
        UPDATE contests
        SET status = 'ended',
            prizes_distributed = 1
        WHERE id = ?
      `).run(contestId);
    });

    runTx();

    try {
      const io = socketService.getIO();
      if (io) {
        io.emit('contest:ended', { contestId, winners: results });
        socketService.notifyLeaderboardUpdated();
      }
    } catch (e) {}

    return {
      awarded: results.length,
      winners: results,
      message: `Récompenses distribuées avec succès à ${results.length} gagnant(s) !`
    };
  },

  /**
   * Clôturer ou supprimer un concours
   */
  deleteContest(contestId) {
    const res = db.prepare('DELETE FROM contests WHERE id = ?').run(contestId);
    if (res.changes === 0) {
      throw new Error('Concours introuvable.');
    }
    return true;
  }
};

module.exports = contestService;
