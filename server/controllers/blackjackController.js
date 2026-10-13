const db = require('../database/db');
const blackjackEngine = require('../services/games/blackjackEngine');

// Helper pour synchroniser les résultats et créditer le joueur
let recordGameResultFn = null;
function setRecordGameResultFn(fn) {
  recordGameResultFn = fn;
}

function recordGameResult(userId, gameType, bet, payout, details, alreadyDeducted = false) {
  if (recordGameResultFn) {
    return recordGameResultFn(userId, gameType, bet, payout, details, alreadyDeducted);
  }
  const gameController = require('./gameController');
  return gameController.recordGameResult(userId, gameType, bet, payout, details, alreadyDeducted);
}

// Parse les mains depuis la session (compatible format tableau JSON ou colonnes legacy)
function parseSessionHands(session) {
  if (session.hands) {
    try {
      const parsed = JSON.parse(session.hands);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }

  // Format legacy (1, 2 ou 3 mains)
  const hand1 = JSON.parse(session.player_hand);
  const hands = [
    {
      id: 1,
      cards: hand1,
      score: blackjackEngine.calculateHand(hand1).score,
      bet: session.bet,
      status: session.status_1 || (session.status === 'playing' ? 'playing' : 'finished'),
      canDouble: session.can_double === 1,
      canSplit: session.can_split === 1,
      isBlackjack: blackjackEngine.calculateHand(hand1).isBlackjack
    }
  ];

  if (session.player_hand_2) {
    const hand2 = JSON.parse(session.player_hand_2);
    hands.push({
      id: 2,
      cards: hand2,
      score: blackjackEngine.calculateHand(hand2).score,
      bet: session.bet_2 || session.bet,
      status: session.status_2 || 'waiting',
      canDouble: session.can_double_2 === 1,
      canSplit: false,
      isBlackjack: blackjackEngine.calculateHand(hand2).isBlackjack
    });
  }

  if (session.player_hand_3) {
    const hand3 = JSON.parse(session.player_hand_3);
    hands.push({
      id: 3,
      cards: hand3,
      score: blackjackEngine.calculateHand(hand3).score,
      bet: session.bet_3 || session.bet,
      status: session.status_3 || 'waiting',
      canDouble: session.can_double_3 === 1,
      canSplit: false,
      isBlackjack: blackjackEngine.calculateHand(hand3).isBlackjack
    });
  }

  return hands;
}

// Parse les sidebets depuis la session
function parseSessionSidebets(session) {
  if (session && session.sidebets) {
    try {
      return JSON.parse(session.sidebets);
    } catch (e) {}
  }
  return null;
}

// Synchronise l'état des mains en base de données
function syncSessionColumns(sessionData, hands, userId) {
  const h1 = hands[0] || { cards: [], bet: 0, status: null, canDouble: false, canSplit: false };
  const h2 = hands[1] || null;
  const h3 = hands[2] || null;

  db.prepare(`
    UPDATE blackjack_sessions
    SET deck = ?,
        hands = ?,
        hands_count = ?,
        sidebets = ?,
        player_hand = ?,
        player_hand_2 = ?,
        player_hand_3 = ?,
        bet = ?,
        bet_2 = ?,
        bet_3 = ?,
        active_hand = ?,
        can_double = ?,
        can_double_2 = ?,
        can_double_3 = ?,
        can_split = ?,
        status_1 = ?,
        status_2 = ?,
        status_3 = ?,
        status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    JSON.stringify(sessionData.deck),
    JSON.stringify(hands),
    hands.length,
    sessionData.sidebets ? JSON.stringify(sessionData.sidebets) : null,
    JSON.stringify(h1.cards),
    h2 ? JSON.stringify(h2.cards) : null,
    h3 ? JSON.stringify(h3.cards) : null,
    h1.bet,
    h2 ? h2.bet : 0,
    h3 ? h3.bet : 0,
    sessionData.activeHand,
    h1.canDouble ? 1 : 0,
    h2 && h2.canDouble ? 1 : 0,
    h3 && h3.canDouble ? 1 : 0,
    h1.canSplit ? 1 : 0,
    h1.status,
    h2 ? h2.status : null,
    h3 ? h3.status : null,
    sessionData.status || 'playing',
    userId
  );
}

// Trouve l'identifiant de la prochaine main en attente de jeu
function getNextPlayingHandId(hands, currentHandId) {
  const currentIdx = hands.findIndex(h => h.id === currentHandId);
  for (let i = currentIdx + 1; i < hands.length; i++) {
    if (hands[i].status === 'playing' || hands[i].status === 'waiting') {
      return hands[i].id;
    }
  }
  return null;
}

// Résout le tour complet contre le croupier
function resolveMultiHandGame(userId, deck, hands, dealerHand, sessionSidebets = null) {
  // Si toutes les mains ont sauté (bust), le croupier ne tire pas de carte supplémentaire
  const allBusted = hands.every(h => h.status === 'bust' || h.score > 21);

  let dealerCalc = blackjackEngine.calculateHand(dealerHand);
  if (!allBusted) {
    while (dealerCalc.score < 17) {
      dealerHand.push(deck.pop());
      dealerCalc = blackjackEngine.calculateHand(dealerHand);
    }
  }

  // Évaluation indépendante de chaque main du joueur face au croupier
  for (const h of hands) {
    const calc = blackjackEngine.calculateHand(h.cards);
    h.score = calc.score;

    if (h.isBlackjack || h.status === 'blackjack') {
      if (dealerCalc.isBlackjack) {
        h.outcome = 'push';
        h.payout = h.bet;
      } else {
        h.outcome = 'blackjack';
        h.payout = Math.floor(h.bet * 2.5);
      }
    } else if (h.status === 'bust' || calc.isBust) {
      h.outcome = 'bust';
      h.payout = 0;
    } else if (dealerCalc.isBust) {
      h.outcome = 'dealer_bust';
      h.payout = h.bet * 2;
    } else if (calc.score > dealerCalc.score) {
      h.outcome = 'win';
      h.payout = h.bet * 2;
    } else if (calc.score === dealerCalc.score) {
      h.outcome = 'push';
      h.payout = h.bet;
    } else {
      h.outcome = 'lose';
      h.payout = 0;
    }
  }

  // Résolution finale de l'Assurance si présente
  if (sessionSidebets && sessionSidebets.insurance && sessionSidebets.insurance.bet > 0) {
    const insRes = blackjackEngine.evaluateInsurance(dealerHand, sessionSidebets.insurance.bet);
    sessionSidebets.insurance = insRes;
  }

  // Recalcul des totaux de sidebets
  let totalSidebetsBet = sessionSidebets ? (sessionSidebets.totalSidebetsBet || 0) : 0;
  let totalSidebetsPayout = 0;
  if (sessionSidebets) {
    (sessionSidebets.perfectPairs || []).forEach(p => { totalSidebetsPayout += (p.payout || 0); });
    (sessionSidebets.plus3 || []).forEach(p => { totalSidebetsPayout += (p.payout || 0); });
    if (sessionSidebets.insurance) {
      totalSidebetsPayout += (sessionSidebets.insurance.payout || 0);
    }
    sessionSidebets.totalSidebetsPayout = totalSidebetsPayout;
  }

  const mainBetsTotal = hands.reduce((sum, h) => sum + h.bet, 0);
  const mainPayoutTotal = hands.reduce((sum, h) => sum + h.payout, 0);
  const totalBet = mainBetsTotal + totalSidebetsBet;
  const totalPayout = mainPayoutTotal + totalSidebetsPayout;

  // Suppression de la session en base
  db.prepare('DELETE FROM blackjack_sessions WHERE user_id = ?').run(userId);

  // Enregistrement atomique du résultat et crédit des gains
  const { newCoins } = recordGameResult(userId, 'blackjack', totalBet, totalPayout, {
    multiHand: true,
    handsCount: hands.length,
    hands,
    sidebets: sessionSidebets,
    mainPayout: mainPayoutTotal,
    sidebetsPayout: totalSidebetsPayout,
    dealerHand,
    dealerScore: dealerCalc.score
  }, true);

  const h1 = hands[0];
  const h2 = hands[1];
  const h3 = hands[2];

  return {
    activeGame: false,
    status: 'finished',
    handsCount: hands.length,
    hands,
    totalBet,
    mainBet: mainBetsTotal,
    payout: totalPayout,
    mainPayout: mainPayoutTotal,
    sidebetsPayout: totalSidebetsPayout,
    sidebets: sessionSidebets,
    net: totalPayout - totalBet,
    dealerHand,
    dealerScore: dealerCalc.score,
    coins: newCoins,
    // Compatibilité descendante
    playerHand: h1 ? h1.cards : [],
    playerScore: h1 ? h1.score : 0,
    playerHand2: h2 ? h2.cards : null,
    playerScore2: h2 ? h2.score : null,
    playerHand3: h3 ? h3.cards : null,
    playerScore3: h3 ? h3.score : null,
    hasSplit: hands.length > 1,
    outcome: h1 ? h1.outcome : 'lose',
    outcome1: h1 ? h1.outcome : null,
    outcome2: h2 ? h2.outcome : null,
    outcome3: h3 ? h3.outcome : null,
    payout1: h1 ? h1.payout : 0,
    payout2: h2 ? h2.payout : 0,
    payout3: h3 ? h3.payout : 0
  };
}

exports.getBlackjackState = (req, res) => {
  const userId = req.user.id;
  const session = db.prepare('SELECT * FROM blackjack_sessions WHERE user_id = ?').get(userId);

  if (!session) {
    return res.json({ activeGame: false });
  }

  const hands = parseSessionHands(session);
  const sidebets = parseSessionSidebets(session);
  const dealerHand = JSON.parse(session.dealer_hand);
  const isPlaying = session.status === 'playing';

  const visibleDealerHand = isPlaying ? [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }] : dealerHand;
  const dealerScore = isPlaying ? blackjackEngine.calculateHand([dealerHand[0]]).score : blackjackEngine.calculateHand(dealerHand).score;

  const activeHandId = session.active_hand || 1;
  const currentHand = hands.find(h => h.id === activeHandId) || hands[0];

  const h1 = hands[0];
  const h2 = hands[1];
  const h3 = hands[2];

  return res.json({
    activeGame: true,
    status: session.status,
    handsCount: hands.length,
    hands,
    activeHand: activeHandId,
    dealerHand: visibleDealerHand,
    dealerScore,
    dealerUpcard: dealerHand[0],
    canDouble: currentHand ? currentHand.canDouble : false,
    canSplit: currentHand ? currentHand.canSplit : false,
    sidebets,
    totalBet: hands.reduce((sum, h) => sum + (h.bet || 0), 0) + (sidebets?.totalSidebetsBet || 0),
    // Compatibilité descendante
    bet: h1 ? h1.bet : session.bet,
    bet2: h2 ? h2.bet : 0,
    bet3: h3 ? h3.bet : 0,
    playerHand: h1 ? h1.cards : [],
    playerScore: h1 ? h1.score : 0,
    playerHand2: h2 ? h2.cards : null,
    playerScore2: h2 ? h2.score : null,
    playerHand3: h3 ? h3.cards : null,
    playerScore3: h3 ? h3.score : null,
    hasSplit: hands.length > 1
  });
};

exports.dealBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const bet = Number(req.body.bet);
    let handsCount = Number(req.body.handsCount) || 1;
    const rawSidebets = req.body.sidebets || {};

    if (!Number.isInteger(bet) || bet < 10) {
      return res.status(400).json({ error: 'Mise invalide (minimum 10 jetons par main).' });
    }

    if (!Number.isInteger(handsCount) || handsCount < 1 || handsCount > 3) {
      return res.status(400).json({ error: 'Nombre de mains invalide (choisis entre 1 et 3 mains).' });
    }

    // Gestion et calcul des sidebets
    const ppPerHand = Math.max(0, parseInt(rawSidebets.perfectPairs, 10) || 0);
    const p3PerHand = Math.max(0, parseInt(rawSidebets.plus3, 10) || 0);
    const insuranceBet = Math.max(0, parseInt(rawSidebets.insurance, 10) || 0);

    const mainBetTotal = bet * handsCount;
    const ppTotal = ppPerHand * handsCount;
    const p3Total = p3PerHand * handsCount;
    const totalSidebetsBet = ppTotal + p3Total + insuranceBet;
    const totalBetRequired = mainBetTotal + totalSidebetsBet;

    // Vérifier si une partie est déjà active
    const existing = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (existing) {
      return res.status(400).json({ error: 'Une partie de Blackjack est déjà en cours ! Termine-la d’abord.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < totalBetRequired) {
      return res.status(400).json({
        error: `Solde insuffisant pour ce tour (${totalBetRequired} jetons requis : ${handsCount} main${handsCount > 1 ? 's' : ''} × ${bet} 🪙 + mises annexes : ${totalSidebetsBet} 🪙, solde actuel : ${user ? user.coins : 0} 🪙).`
      });
    }

    // Déduire la mise totale immédiatement et de façon atomique
    const updateDeduct = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(totalBetRequired, userId, totalBetRequired);
    if (updateDeduct.changes === 0) {
      return res.status(400).json({
        error: `Solde insuffisant pour ce tour (${totalBetRequired} jetons requis).`
      });
    }

    const coinsAfterDeduct = user.coins - totalBetRequired;
    const deck = blackjackEngine.createDeck();

    const dealerHand = [deck.pop(), deck.pop()];
    const dealerUpcard = dealerHand[0];
    const dealerCalc = blackjackEngine.calculateHand(dealerHand);

    const sidebetsDetails = {
      perfectPairs: [],
      plus3: [],
      insurance: null,
      totalSidebetsBet,
      totalSidebetsPayout: 0
    };

    let sidebetsPayoutSum = 0;

    const hands = [];
    for (let i = 0; i < handsCount; i++) {
      const cards = [deck.pop(), deck.pop()];
      const calc = blackjackEngine.calculateHand(cards);
      const isBJ = calc.isBlackjack;

      // Évaluation des sidebets pour cette main
      const ppRes = blackjackEngine.evaluatePerfectPairs(cards[0], cards[1], ppPerHand);
      const p3Res = blackjackEngine.evaluate21Plus3(cards[0], cards[1], dealerUpcard, p3PerHand);

      sidebetsDetails.perfectPairs.push({ handId: i + 1, ...ppRes });
      sidebetsDetails.plus3.push({ handId: i + 1, ...p3Res });

      sidebetsPayoutSum += (ppRes.payout || 0) + (p3Res.payout || 0);

      hands.push({
        id: i + 1,
        cards,
        score: calc.score,
        isBlackjack: isBJ,
        isBust: false,
        bet,
        status: isBJ ? 'blackjack' : (i === 0 ? 'playing' : 'waiting'),
        canDouble: !isBJ,
        canSplit: blackjackEngine.canSplit(cards) && (coinsAfterDeduct >= bet),
        sidebets: {
          perfectPairs: ppRes,
          plus3: p3Res
        }
      });
    }

    // Évaluation de l'Assurance
    if (dealerUpcard.rank === 'A' && insuranceBet > 0) {
      const insRes = blackjackEngine.evaluateInsurance(dealerHand, insuranceBet);
      sidebetsDetails.insurance = insRes;
      sidebetsPayoutSum += (insRes.payout || 0);
    } else if (insuranceBet > 0) {
      sidebetsDetails.insurance = { bet: insuranceBet, win: false, payout: 0, label: 'Non applicable (pas d’As)' };
    }

    sidebetsDetails.totalSidebetsPayout = sidebetsPayoutSum;

    // Fin immédiate dès le deal si dealer a Blackjack naturel OU toutes les mains ont Blackjack
    if (dealerCalc.isBlackjack || hands.every(h => h.isBlackjack)) {
      const finalResult = resolveMultiHandGame(userId, deck, hands, dealerHand, sidebetsDetails);
      return res.json(finalResult);
    }

    // Trouver la première main active
    const firstActive = hands.find(h => !h.isBlackjack) || hands[0];
    firstActive.status = 'playing';
    const activeHandId = firstActive.id;

    // Enregistrement en base de données
    const h1 = hands[0];
    const h2 = hands[1] || null;
    const h3 = hands[2] || null;

    db.prepare(`
      INSERT OR REPLACE INTO blackjack_sessions (
        user_id, deck, hands, hands_count, sidebets,
        player_hand, player_hand_2, player_hand_3,
        dealer_hand, bet, bet_2, bet_3,
        status, active_hand,
        can_double, can_double_2, can_double_3,
        can_split, split_aces,
        status_1, status_2, status_3
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'playing', ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      userId,
      JSON.stringify(deck),
      JSON.stringify(hands),
      hands.length,
      JSON.stringify(sidebetsDetails),
      JSON.stringify(h1.cards),
      h2 ? JSON.stringify(h2.cards) : null,
      h3 ? JSON.stringify(h3.cards) : null,
      JSON.stringify(dealerHand),
      h1.bet,
      h2 ? h2.bet : 0,
      h3 ? h3.bet : 0,
      activeHandId,
      h1.canDouble ? 1 : 0,
      h2 && h2.canDouble ? 1 : 0,
      h3 && h3.canDouble ? 1 : 0,
      h1.canSplit ? 1 : 0,
      h1.status,
      h2 ? h2.status : null,
      h3 ? h3.status : null
    );

    return res.json({
      activeGame: true,
      status: 'playing',
      handsCount: hands.length,
      hands,
      activeHand: activeHandId,
      bet,
      totalBet: totalBetRequired,
      sidebets: sidebetsDetails,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerUpcard: dealerHand[0],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      canDouble: firstActive.canDouble,
      canSplit: firstActive.canSplit,
      coins: coinsAfterDeduct,
      // Backward compatibility
      playerHand: h1.cards,
      playerScore: h1.score,
      playerHand2: h2 ? h2.cards : null,
      playerScore2: h2 ? h2.score : null,
      playerHand3: h3 ? h3.cards : null,
      playerScore3: h3 ? h3.score : null,
      hasSplit: hands.length > 1
    });
  } catch (err) {
    console.error('Erreur deal blackjack:', err);
    return res.status(500).json({ error: 'Erreur Blackjack.' });
  }
};

exports.splitBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (!session) {
      return res.status(400).json({ error: 'Aucune partie active de Blackjack.' });
    }

    const hands = parseSessionHands(session);
    const sidebets = parseSessionSidebets(session);
    const activeHand = hands.find(h => h.id === session.active_hand);
    if (!activeHand || !activeHand.canSplit) {
      return res.status(400).json({ error: 'Le split n’est pas disponible sur cette main.' });
    }

    const bet = activeHand.bet;
    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour splitter (seconde mise égale requise).' });
    }

    const updateDeduct = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(bet, userId, bet);
    if (updateDeduct.changes === 0) {
      return res.status(400).json({ error: 'Solde insuffisant pour splitter.' });
    }

    const deck = JSON.parse(session.deck);
    const dealerHand = JSON.parse(session.dealer_hand);

    const initialCards = activeHand.cards;
    const card1 = initialCards[0];
    const card2 = initialCards[1];

    const hand1Cards = [card1, deck.pop()];
    const hand2Cards = [card2, deck.pop()];

    const calc1 = blackjackEngine.calculateHand(hand1Cards);
    const calc2 = blackjackEngine.calculateHand(hand2Cards);

    const isAces = card1.rank === 'A' || card1.value === 11;

    activeHand.cards = hand1Cards;
    activeHand.score = calc1.score;
    activeHand.canDouble = !isAces;
    activeHand.canSplit = false;
    activeHand.status = isAces ? 'stand' : 'playing';

    const activeIdx = hands.indexOf(activeHand);
    const newHand = {
      cards: hand2Cards,
      score: calc2.score,
      bet,
      status: isAces ? 'stand' : 'waiting',
      canDouble: !isAces,
      canSplit: false,
      isSplit: true
    };
    // Insérer la deuxième main immédiatement après la main splittée
    hands.splice(activeIdx + 1, 0, newHand);

    // Renuméroter proprement tous les IDs pour correspondre aux index 1, 2, 3...
    hands.forEach((h, idx) => {
      h.id = idx + 1;
    });

    const activeHandId = activeHand.id;

    // Si As splittés et toutes les mains en stand : terminer immédiatement
    if (hands.every(h => h.status !== 'playing' && h.status !== 'waiting')) {
      const finalResult = resolveMultiHandGame(userId, deck, hands, dealerHand, sidebets);
      return res.json(finalResult);
    }

    syncSessionColumns({ deck, activeHand: activeHandId, status: 'playing', sidebets }, hands, userId);
    const remainingCoins = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId).coins;

    return res.json({
      activeGame: true,
      status: 'playing',
      handsCount: hands.length,
      hands,
      activeHand: activeHandId,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      canDouble: activeHand.canDouble,
      canSplit: false,
      sidebets,
      coins: remainingCoins,
      playerHand: hands[0].cards,
      playerScore: hands[0].score,
      playerHand2: hands[1] ? hands[1].cards : null,
      playerScore2: hands[1] ? hands[1].score : null,
      hasSplit: true
    });
  } catch (err) {
    console.error('Erreur split blackjack:', err);
    return res.status(500).json({ error: 'Erreur Split Blackjack.' });
  }
};

exports.hitBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (!session) {
      return res.status(400).json({ error: 'Aucune partie en cours.' });
    }

    const deck = JSON.parse(session.deck);
    const dealerHand = JSON.parse(session.dealer_hand);
    const hands = parseSessionHands(session);
    const sidebets = parseSessionSidebets(session);
    const activeHand = hands.find(h => h.id === session.active_hand);

    if (!activeHand) {
      return res.status(400).json({ error: 'Main active introuvable.' });
    }

    const card = deck.pop();
    activeHand.cards.push(card);
    const calc = blackjackEngine.calculateHand(activeHand.cards);
    activeHand.score = calc.score;
    activeHand.canDouble = false;
    activeHand.canSplit = false;

    if (calc.isBust) {
      activeHand.status = 'bust';
    } else if (calc.score === 21) {
      activeHand.status = 'stand';
    }

    if (activeHand.status !== 'playing') {
      const nextId = getNextPlayingHandId(hands, activeHand.id);
      if (nextId === null) {
        // Toutes les mains du joueur ont fini -> tour du croupier
        const finalResult = resolveMultiHandGame(userId, deck, hands, dealerHand, sidebets);
        return res.json(finalResult);
      } else {
        const nextHand = hands.find(h => h.id === nextId);
        nextHand.status = 'playing';
        syncSessionColumns({ deck, activeHand: nextId, status: 'playing', sidebets }, hands, userId);

        return res.json({
          activeGame: true,
          status: 'playing',
          handsCount: hands.length,
          hands,
          activeHand: nextId,
          sidebets,
          dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
          dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
          canDouble: nextHand.canDouble,
          canSplit: nextHand.canSplit,
          playerHand: hands[0].cards,
          playerScore: hands[0].score,
          playerHand2: hands[1] ? hands[1].cards : null,
          playerScore2: hands[1] ? hands[1].score : null,
          playerHand3: hands[2] ? hands[2].cards : null,
          playerScore3: hands[2] ? hands[2].score : null,
          hasSplit: hands.length > 1
        });
      }
    }

    // La main active continue
    syncSessionColumns({ deck, activeHand: activeHand.id, status: 'playing', sidebets }, hands, userId);

    return res.json({
      activeGame: true,
      status: 'playing',
      handsCount: hands.length,
      hands,
      activeHand: activeHand.id,
      sidebets,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      canDouble: false,
      canSplit: false,
      playerHand: hands[0].cards,
      playerScore: hands[0].score,
      playerHand2: hands[1] ? hands[1].cards : null,
      playerScore2: hands[1] ? hands[1].score : null,
      playerHand3: hands[2] ? hands[2].cards : null,
      playerScore3: hands[2] ? hands[2].score : null,
      hasSplit: hands.length > 1
    });
  } catch (err) {
    console.error('Erreur hit blackjack:', err);
    return res.status(500).json({ error: 'Erreur Hit Blackjack.' });
  }
};

exports.standBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (!session) {
      return res.status(400).json({ error: 'Aucune partie en cours.' });
    }

    const deck = JSON.parse(session.deck);
    const dealerHand = JSON.parse(session.dealer_hand);
    const hands = parseSessionHands(session);
    const sidebets = parseSessionSidebets(session);
    const activeHand = hands.find(h => h.id === session.active_hand);

    if (!activeHand) {
      return res.status(400).json({ error: 'Main active introuvable.' });
    }

    activeHand.status = 'stand';

    const nextId = getNextPlayingHandId(hands, activeHand.id);
    if (nextId === null) {
      const finalResult = resolveMultiHandGame(userId, deck, hands, dealerHand, sidebets);
      return res.json(finalResult);
    }

    const nextHand = hands.find(h => h.id === nextId);
    nextHand.status = 'playing';
    syncSessionColumns({ deck, activeHand: nextId, status: 'playing', sidebets }, hands, userId);

    return res.json({
      activeGame: true,
      status: 'playing',
      handsCount: hands.length,
      hands,
      activeHand: nextId,
      sidebets,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      canDouble: nextHand.canDouble,
      canSplit: nextHand.canSplit,
      playerHand: hands[0].cards,
      playerScore: hands[0].score,
      playerHand2: hands[1] ? hands[1].cards : null,
      playerScore2: hands[1] ? hands[1].score : null,
      playerHand3: hands[2] ? hands[2].cards : null,
      playerScore3: hands[2] ? hands[2].score : null,
      hasSplit: hands.length > 1
    });
  } catch (err) {
    console.error('Erreur stand blackjack:', err);
    return res.status(500).json({ error: 'Erreur Stand Blackjack.' });
  }
};

exports.doubleBlackjack = (req, res) => {
  try {
    const userId = req.user.id;
    const session = db.prepare("SELECT * FROM blackjack_sessions WHERE user_id = ? AND status = 'playing'").get(userId);
    if (!session) {
      return res.status(400).json({ error: 'Aucune partie en cours.' });
    }

    const deck = JSON.parse(session.deck);
    const dealerHand = JSON.parse(session.dealer_hand);
    const hands = parseSessionHands(session);
    const sidebets = parseSessionSidebets(session);
    const activeHand = hands.find(h => h.id === session.active_hand);

    if (!activeHand || !activeHand.canDouble) {
      return res.status(400).json({ error: 'Impossible de doubler sur cette main.' });
    }

    const user = db.prepare('SELECT coins FROM users WHERE id = ?').get(userId);
    if (!user || user.coins < activeHand.bet) {
      return res.status(400).json({ error: 'Solde insuffisant pour doubler la mise.' });
    }

    const updateDeduct = db.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').run(activeHand.bet, userId, activeHand.bet);
    if (updateDeduct.changes === 0) {
      return res.status(400).json({ error: 'Solde insuffisant pour doubler.' });
    }

    const card = deck.pop();
    activeHand.cards.push(card);
    activeHand.bet *= 2;
    activeHand.canDouble = false;
    activeHand.canSplit = false;
    const calc = blackjackEngine.calculateHand(activeHand.cards);
    activeHand.score = calc.score;
    activeHand.status = calc.isBust ? 'bust' : 'doubled';

    const nextId = getNextPlayingHandId(hands, activeHand.id);
    if (nextId === null) {
      const finalResult = resolveMultiHandGame(userId, deck, hands, dealerHand, sidebets);
      return res.json(finalResult);
    }

    const nextHand = hands.find(h => h.id === nextId);
    nextHand.status = 'playing';
    syncSessionColumns({ deck, activeHand: nextId, status: 'playing', sidebets }, hands, userId);

    return res.json({
      activeGame: true,
      status: 'playing',
      handsCount: hands.length,
      hands,
      activeHand: nextId,
      sidebets,
      dealerHand: [dealerHand[0], { rank: '?', suit: '?', color: 'hidden' }],
      dealerScore: blackjackEngine.calculateHand([dealerHand[0]]).score,
      canDouble: nextHand.canDouble,
      canSplit: nextHand.canSplit,
      coins: user.coins - (activeHand.bet / 2),
      playerHand: hands[0].cards,
      playerScore: hands[0].score,
      playerHand2: hands[1] ? hands[1].cards : null,
      playerScore2: hands[1] ? hands[1].score : null,
      playerHand3: hands[2] ? hands[2].cards : null,
      playerScore3: hands[2] ? hands[2].score : null,
      hasSplit: hands.length > 1
    });
  } catch (err) {
    console.error('Erreur double blackjack:', err);
    return res.status(500).json({ error: 'Erreur Double Blackjack.' });
  }
};

module.exports = {
  getBlackjackState: exports.getBlackjackState,
  dealBlackjack: exports.dealBlackjack,
  splitBlackjack: exports.splitBlackjack,
  hitBlackjack: exports.hitBlackjack,
  standBlackjack: exports.standBlackjack,
  doubleBlackjack: exports.doubleBlackjack,
  setRecordGameResultFn
};
