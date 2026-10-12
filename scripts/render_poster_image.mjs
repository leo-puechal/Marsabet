// scripts/render_poster_image.mjs
import puppeteer from 'puppeteer-core';
import path from 'path';

async function render() {
  console.log('Rendering poster image...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1400,2000'],
    headless: true
  });

  const page = await browser.newPage();
  // Dimensions pour un poster A3 / A4 haute résolution
  await page.setViewport({ width: 1300, height: 1850, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3001/affiche.html', { waitUntil: 'networkidle0' });

  // Attendre chargement polices Google Fonts et images
  await new Promise(r => setTimeout(r, 1500));

  const posterCanvas = await page.$('#posterCanvas');
  const outPath = path.resolve('public/affiche_marsabet.png');

  if (posterCanvas) {
    await posterCanvas.screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage: true });
  }

  await browser.close();
  console.log('Poster image successfully created at:', outPath);
}

render().catch(console.error);
