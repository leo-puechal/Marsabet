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
   - **Interface Admin BDE** : Scan/validation de code en 1 clic au stand, interdiction stricte de réutilisation (code à usage unique), gestion des stocks et catalogue. Compte administrateur par défaut : `bde_admin` (clé secrète et mot de passe configurables via `.env`).

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

## 🌐 Accès Réseau Local (Wi-Fi / LAN Multi-Appareils)

Marsabet est configuré pour écouter sur **`0.0.0.0`** avec **CORS dynamique**, ce qui permet à tous les smartphones, tablettes et ordinateurs connectés au même réseau Wi-Fi d'accéder au casino avec une **base de données 100% centralisée et synchronisée en temps réel**.

### 1. Trouver l'IP locale de la machine hôte selon votre OS

> ⚠️ **Important** : Ne choisissez **JAMAIS** une interface virtuelle ou Docker (comme `docker0`, `br-xxxx`, `vethxxxx`, ou la boucle locale `lo`). Cherchez uniquement l'interface Wi-Fi physique active.

- **🐧 Linux** :
  ```bash
  ip -br addr
  # ou
  ip addr
  ```
  Repérez l'interface Wi-Fi active (généralement nommée `wlan0` ou `wlp0s20f3`) et notez l'adresse IPv4 (ex: `10.79.216.0` ou `192.168.1.42`).

- **🍏 macOS** :
  ```bash
  ipconfig getifaddr en0
  # ou
  ifconfig
  ```
  L'interface Wi-Fi sur Mac est quasi toujours `en0`.

- **🪟 Windows** :
  ```powershell
  ipconfig
  ```
  Faites défiler jusqu'à la section **Carte réseau sans fil Wi-Fi** et relevez la ligne **Adresse IPv4** (ex: `192.168.1.50`). *Ignorez les cartes WSL, Hyper-V ou VirtualBox.*

---

### 2. Lancement du serveur

```bash
npm start
```
Au démarrage, Marsabet affiche automatiquement dans le terminal :
```text
=============================================================
🎰 MARSABET CASINO VIRTUEL DÉMARRÉ SUR LE PORT 3001
🌐 Accès local (machine hôte) : http://localhost:3001
📡 Accès Réseau Local (Wi-Fi / LAN - autres appareils) :
   👉 http://10.79.216.0:3001 (interface wlp0s20f3)
🛡️  Monnaie 100% fictive scolaire - Zéro argent réel
=============================================================
```

---

### 3. Format de l'URL à partager aux autres appareils

Partagez simplement l'URL avec l'IP de la machine hôte et le port :
```text
http://<IP_LOCALE>:<PORT>
```
*Exemple :* `http://10.79.216.0:3001` ou `http://192.168.1.42:3001`.

Tous les participants peuvent ouvrir cette adresse sur leur navigateur mobile (Safari iOS, Chrome Android, Firefox, Edge) sans rien installer !

---

### 4. Prérequis Wi-Fi

- La machine serveur hôte et tous les appareils des élèves doivent impérativement être connectés au **même réseau Wi-Fi local** (ou au même partage de connexion 4G/5G mobile).

---

### 5. Vérification du Pare-feu (Firewall) si la connexion échoue

Si un appareil du réseau affiche *"Délai d'attente dépassé"* ou *"Impossible de se connecter"*, le pare-feu de la machine hôte bloque probablement les connexions entrantes sur le port `3001` :

- **Linux (UFW)** :
  ```bash
  sudo ufw allow 3001/tcp
  sudo ufw reload
  ```
- **Windows (Pare-feu Windows Defender)** :
  1. Ouvrez *Sécurité Windows* > *Pare-feu et protection du réseau*.
  2. Cliquez sur *Autoriser une application via le pare-feu* et cochez **Node.js** pour les réseaux **Privés**.
  3. Ou ouvrez un port entrant : `netsh advfirewall firewall add rule name="Marsabet Port 3001" dir=in action=allow protocol=TCP localport=3001 profile=private`.
- **macOS** :
  - Rendez-vous dans *Réglages Système* > *Réseau* > *Coupe-feu* et assurez-vous que Node.js est autorisé à recevoir des connexions entrantes.

---

### 6. Architecture Centralisée & Synchronisation Temps Réel

- **Base de Données Unique & Centrale** :
  Toutes les données (soldes en jetons, comptes, historique de jeu, stocks de la boutique BDE, demandes de livraison) sont stockées dans **une seule et unique instance SQLite** (`server/database/marsabet.db`) sur la machine serveur, opérée en mode WAL (Write-Ahead Logging). Aucun solde ni résultat de jeu n'est géré en local sur les téléphones des élèves.
- **Validation 100% Côté Serveur** :
  Chaque mise, gain, achat boutique, activation de code promo et tour de roue fait un aller-retour transactionnel complet vers le serveur avant la moindre mise à jour d'affichage.
- **Synchronisation Hybride (Socket.io + Polling 6s)** :
  - **Socket.io** : propagation instantanée (0 ms) dès qu'un joueur gagne (bandeau ticker animé en direct), qu'un achat décrémente un stock de la boutique, ou que le classement évolue.
  - **Polling Périodique (Fallback)** : un cycle automatique toutes les 6 secondes (et au déverrouillage de l'écran du smartphone via l'événement `visibilitychange`) garantit qu'aucun appareil ne reste désynchronisé, même en cas de micro-coupure Wi-Fi.

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
