// scripts/capture_real_screenshots.mjs
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Token LeoMars
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJMZW9NYXJzIiwicm9sZSI6InN0dWRlbnQiLCJpYXQiOjE3OTE4MDQ3NTksImV4cCI6MTc5MjQwOTU1OX0.cs1SWEqS7uVloOlrE-0_nTPRyj6hlEyFAeQGVLh784s';

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1600,1050'],
    headless: true
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Initialiser le localStorage avec le token utilisateur
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle0' });
  await page.evaluate((tok) => {
    localStorage.setItem('marsabet_token', tok);
  }, token);

  // Recharger pour charger la session
  await page.goto('http://localhost:3001/lobby', { waitUntil: 'networkidle0' });
  await page.waitForTimeout ? page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));

  console.log('Capture 1: Lobby...');
  await page.screenshot({ path: path.join(outDir, 'screen_lobby.png') });

  // Capture 2: Crash Galactique
  console.log('Capture 2: Crash...');
  await page.goto('http://localhost:3001/jeux/crash', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  // Simuler un état actif de Crash sur le canvas pour un visuel spectaculaire
  await page.evaluate(() => {
    if (window.CrashGame) {
      window.CrashGame.currentMultiplier = 3.84;
      const multDisplay = document.getElementById('crashMultiplierDisplay');
      if (multDisplay) {
        multDisplay.textContent = '×3.84';
        multDisplay.className = 'crash-multiplier-big tension-mid';
      }
      const statusLabel = document.getElementById('crashStatusLabel');
      if (statusLabel) {
        statusLabel.textContent = 'FUSÉE EN PLEINE ASCENSION !';
        statusLabel.className = 'crash-status-label';
      }
      const actionBtn = document.getElementById('crashActionBtn');
      if (actionBtn) {
        actionBtn.className = 'btn-crash-action btn-cashout';
        actionBtn.innerHTML = 'ENCAISSER <span class="subtext">+384 🪙</span>';
      }
      window.CrashGame.renderCanvasFrame(4.5);
    }
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, 'screen_crash.png') });

  // Capture 3: Machine à sous
  console.log('Capture 3: Slots...');
  await page.goto('http://localhost:3001/jeux/machine-a-sous', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, 'screen_slots.png') });

  // Capture 4: Blackjack Table
  console.log('Capture 4: Blackjack...');
  await page.goto('http://localhost:3001/jeux/blackjack', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  // Cliquer sur Distribuer si le bouton est dispo
  await page.evaluate(() => {
    const dealBtn = document.getElementById('bjDealBtn');
    if (dealBtn && !dealBtn.disabled) dealBtn.click();
  });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(outDir, 'screen_blackjack.png') });

  // Capture 5: Slider Over/Under
  console.log('Capture 5: Slider...');
  await page.goto('http://localhost:3001/jeux/slider', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  // Configurer le slider sur 65 avec palet animé
  await page.evaluate(() => {
    if (window.SliderGame) {
      window.SliderGame.target = 65;
      window.SliderGame.mode = 'over';
      const range = document.getElementById('sliderRange');
      if (range) range.value = 65;
      window.SliderGame.updateCalculations();
      const puck = document.getElementById('sliderPuck');
      if (puck) {
        puck.style.display = 'flex';
        puck.style.left = '78.4%';
        puck.textContent = '78.4';
        puck.className = 'slider-puck win';
      }
      const badge = document.getElementById('sliderResultBadge');
      if (badge) {
        badge.style.display = 'inline-flex';
        badge.className = 'slider-result-badge badge-win';
        badge.innerHTML = 'Résultat : <strong>78.40</strong> ✓ GAGNÉ';
      }
    }
  });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(outDir, 'screen_slider.png') });

  // Capture 6: Roues de la fortune
  console.log('Capture 6: Roues...');
  await page.goto('http://localhost:3001/roues', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, 'screen_wheels.png') });

  // Capture 7: Boutique BDE
  console.log('Capture 7: Boutique...');
  await page.goto('http://localhost:3001/boutique', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, 'screen_shop.png') });

  // Capture 8: Catalogue des jeux
  console.log('Capture 8: Catalogue Jeux...');
  await page.goto('http://localhost:3001/jeux', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: path.join(outDir, 'screen_games.png') });

  await browser.close();
  console.log('All screenshots captured successfully in', outDir);
}

main().catch(console.error);
