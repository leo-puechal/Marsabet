// VIP Rank Service based on Total Wagered

const VIP_TIERS = [
  {
    tier: 1,
    name: 'Bronze',
    icon: '🥉',
    color: '#CD7F32',
    gradient: 'linear-gradient(135deg, #B87333 0%, #8C531B 100%)',
    minWager: 0,
    bonusMultiplier: 1.0,
    perk: 'Statut joueur de base',
    perks: ['Statut joueur de base'],
    badgeClass: 'vip-bronze'
  },
  {
    tier: 2,
    name: 'Argent',
    icon: '🥈',
    color: '#CBD5E1',
    gradient: 'linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)',
    minWager: 50000,
    bonusMultiplier: 1.10,
    perk: '+10% sur les bonus & badge argent',
    perks: ['+10% sur les bonus', 'Badge argent'],
    badgeClass: 'vip-argent'
  },
  {
    tier: 3,
    name: 'Or',
    icon: '🥇',
    color: '#FACC15',
    gradient: 'linear-gradient(135deg, #FFE27A 0%, #D4AF37 100%)',
    minWager: 200000,
    bonusMultiplier: 1.25,
    perk: '+25% sur les bonus & liseré doré VIP',
    perks: ['+25% sur les bonus', 'Liseré doré VIP'],
    badgeClass: 'vip-or'
  },
  {
    tier: 4,
    name: 'Platine',
    icon: '💎',
    color: '#38BDF8',
    gradient: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
    minWager: 500000,
    bonusMultiplier: 1.40,
    perk: '+40% sur les bonus & aura azur prestigieuse',
    perks: ['+40% sur les bonus', 'Aura azur prestigieuse'],
    badgeClass: 'vip-platine'
  },
  {
    tier: 5,
    name: 'Diamant',
    icon: '👑',
    color: '#C084FC',
    gradient: 'linear-gradient(135deg, #C084FC 0%, #7E22CE 100%)',
    minWager: 1000000,
    bonusMultiplier: 1.60,
    perk: '+60% sur les bonus & couronne royale violette',
    perks: ['+60% sur les bonus', 'Couronne royale violette'],
    badgeClass: 'vip-diamant'
  },
  {
    tier: 6,
    name: 'Maître Marsabet',
    icon: '🪐',
    color: '#F43F5E',
    gradient: 'linear-gradient(135deg, #FB7185 0%, #BE123C 100%)',
    minWager: 2500000,
    bonusMultiplier: 2.00,
    perk: 'x2 sur tous les bonus & avatar légendaire de Mars',
    perks: ['x2 sur tous les bonus', 'Avatar légendaire de Mars'],
    badgeClass: 'vip-mars'
  }
];

function getVipInfo(totalWagered = 0) {
  const wager = Math.max(0, parseInt(totalWagered) || 0);

  let currentTier = VIP_TIERS[0];
  let nextTier = null;

  for (let i = 0; i < VIP_TIERS.length; i++) {
    if (wager >= VIP_TIERS[i].minWager) {
      currentTier = VIP_TIERS[i];
      nextTier = VIP_TIERS[i + 1] || null;
    } else {
      break;
    }
  }

  let progressPercent = 100;
  let wagerNeeded = 0;

  if (nextTier) {
    const range = nextTier.minWager - currentTier.minWager;
    const currentInRange = wager - currentTier.minWager;
    progressPercent = Math.min(100, Math.max(0, Math.round((currentInRange / range) * 100)));
    wagerNeeded = nextTier.minWager - wager;
  }

  return {
    currentTier,
    nextTier,
    progressPercent,
    wagerNeeded,
    totalWagered: wager,
    isMaxTier: !nextTier
  };
}

module.exports = {
  VIP_TIERS,
  getVipInfo
};
