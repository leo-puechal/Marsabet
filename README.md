# 🪐 Marsabet — Casino Virtuel Récréatif BDE Epitech Marseille

**Marsabet** est une plateforme web de casino virtuel récréatif à usage scolaire et étudiant.  
🛡️ **Monnaie 100% virtuelle et gratuite : aucun argent réel n'est engagé, convertible ou retirable.**

---

## 🎨 Identité Visuelle & Ambiance
- **Palette** : Bleu marine nuit (`#060E1E`, `#0A1F44`), blanc perle et touches dorées métalliques (`#D4AF37`, `#FFE27A`).
- **Typographie** : *Cinzel* (titres et ambiance casino de prestige) et *Outfit* (interface épurée et moderne).
- **Audio** : Moteur sonore synthétisé en direct via la **Web Audio API** (sons de jetons, rouleaux, distribution de cartes, victoires, jackpots) sans dépendances de fichiers externes, avec bouton Mute/Unmute persistant.
- **Responsive** : Compatible mobile, tablette et desktop.

---

## 🛠️ Stack Technique
- **Backend** : Node.js avec **Express.js** (API REST sécurisée avec calcul des résultats 100% côté serveur).
- **Base de données** : **SQLite** avec persistance automatique via `better-sqlite3` en mode WAL.
- **Sécurité & Sessions** :
  - Hachage sécurisé des mots de passe avec **bcryptjs**.
  - Authentification persistante via **JWT** (JSON Web Token).
  - Validation stricte des mises et des soldes côté serveur (aucune triche possible via DevTools).
- **Frontend** : Architecture Single Page Application (SPA) réactive en HTML5, CSS3 modulaire (Variables, Grid, Flexbox, Glassmorphism) et Vanilla ES Modules.

---

## 🎲 Économie & Jeux Inclus

### 💰 Économie Fictive & Boutique Physique BDE
1. **Bonus de bienvenue** : 1 000 jetons offerts à chaque nouveau compte.
2. **Bonus quotidien de connexion** : +100 à +250 jetons par jour avec multiplicateur de série (*streak* jusqu'à 7 jours).
3. **Classement en direct (Leaderboard)** : Podium doré (1er, 2e, 3e) et classement des fortunes virtuelles de l'école.
4. **Profil & Statistiques** : Historique détaillé des 25 dernières parties, total misé, plus gros gain et inventaire des commandes.
5. **Boutique Physique BDE** : Échange des coins virtuels (gagnés uniquement en jouant gratuitement) contre de **vrais produits physiques** distribués par le BDE Marseille (canettes fraîches, barres chocolatées, snacks, stickers, hoodies).
   - **Génération de Code Unique** : Chaque échange déduit les coins et génère un ticket avec un code unique sécurisé `MB-XXXX-XXXX`.
   - **Gestion de Stock Limité** : Produits avec stocks réels décomptés en temps réel et avertissement *"Stock limité, disponible tant que les réserves du BDE le permettent"*.
   - **Interface Admin BDE** : Scan/validation de code en 1 clic au stand, interdiction stricte de réutilisation (code à usage unique), gestion des stocks et catalogue. Compte administrateur par défaut : `bde_admin` / `epitech2026` (ou clé secrète `epitech2026`).

### 🎰 Les 6 Jeux de Casino
1. **Machine à sous (Slots)** : 5 rouleaux, 8 symboles thématiques (Planète Mars Jackpot x100, Diamants, Couronnes, 777...), 10 lignes de paiement et arrêt échelonné des rouleaux.
2. **Blackjack** : Contre le croupier de la maison, sabot de 6 jeux mélangés, As dynamique (1/11), Blackjack naturel payé 3:2, options *Hit*, *Stand* et *Double*.
3. **Roulette Européenne** : Roue animée sur Canvas (37 numéros avec zéro vert), bille réaliste et tapis complet (numéros pleins x36, rouge/noir x2, pair/impair x2, douzaines x3...).
4. **Jeu de Dés (Dice)** : Deux modes : *Double Dés Craps* (paris 7 Chanceux x4, Craps x5, Double x6, Low/High) et mode *Curseur Over/Under* (multiplicateur ajustable jusqu'à 50x).
5. **Roue de la Fortune** : Roue de 16 segments avec multiplicateurs variés et segment *Jackpot Royal 25x*, rotation avec inertie physique et clic sonore.
6. **Plinko Cosmique** : Plateau vertical Canvas avec 12 rangées de clous physiques, 3 niveaux de risque (*Faible*, *Moyen*, *Élevé*) et paniers multiplicateurs jusqu'à x50.

---

## 🚀 Installation & Démarrage Local

### Prérequis
- [Node.js](https://nodejs.org/) (v18 ou supérieur)
- npm

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration (.env)
Un fichier `.env` est configuré par défaut :
```env
PORT=3001
JWT_SECRET=marsabet_secret_key_super_secure_epitech_2026
NODE_ENV=development
DB_PATH=./server/database/marsabet.db
```

### 3. Lancement de l'application
```bash
# Lancement classique
npm start

# Mode développement avec redémarrage automatique
npm run dev
```

L'application est accessible sur :  
👉 **http://localhost:3001**

---

## 📁 Structure du Projet
```
Marsabet/
├── server/
│   ├── config/              # Configuration globale (.env, ports, RTP)
│   ├── database/            # Fichier SQLite et initialisation des tables
│   ├── middlewares/         # Middleware d'authentification JWT
│   ├── controllers/         # Logique Auth, Utilisateurs, Jeux, Boutique
│   ├── services/
│   │   └── games/           # Moteurs de jeu (Slots, BJ, Roulette, Dice, Wheel, Plinko)
│   ├── routes/              # Routes Express (/api/auth, /api/games, etc.)
│   └── server.js            # Point d'entrée du serveur Express & SPA Fallback
├── public/
│   ├── css/                 # Feuilles de style modulaires (thème Navy/Gold)
│   ├── js/
│   │   ├── games/           # Contrôleurs frontend des 6 jeux
│   │   ├── api.js           # Client API avec token JWT
│   │   ├── audio.js         # Synthétiseur sonore Web Audio
│   │   ├── state.js         # Gestionnaire d'état réactif
│   │   ├── ui.js            # Modales, toasts, confettis, navigation
│   │   └── app.js           # Point d'entrée frontend
│   └── index.html           # Interface web complète du casino
├── .env.example
├── package.json
└── README.md
```
