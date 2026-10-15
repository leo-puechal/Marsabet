const nodemailer = require('nodemailer');

/**
 * Service d'envoi automatique d'email au BDE (marsatek.bde@gmail.com)
 * Utilisé lorsqu'un élève valide une demande de livraison directe (boutique ou lot roue)
 */

// Échappe tout contenu saisi par un utilisateur avant insertion dans le HTML de l'email (anti injection / phishing)
function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Supprime les retours à la ligne (injection d'en-têtes d'email)
function oneLine(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[\r\n]+/g, ' ').trim();
}

// Numéro de téléphone : uniquement chiffres, espaces, + . - ( )
function cleanPhone(value) {
  return String(value || '').replace(/[^0-9+\-.() ]/g, '').slice(0, 30);
}

async function sendDeliveryNotification(delivery) {
  const bdeEmail = process.env.BDE_EMAIL || 'marsatek.bde@gmail.com';
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  // Si les identifiants ne sont pas encore configurés dans .env
  if (!emailUser || !emailPass) {
    const warningMsg = `Identifiants Gmail (EMAIL_USER / EMAIL_PASS) non configurés dans le fichier .env. L'email pour la demande #${delivery.id} n'a pas pu être expédié, mais la demande de livraison est bien enregistrée en base de données.`;
    console.warn(`[EmailService] ⚠️ ${warningMsg}`);
    return {
      success: false,
      status: 'not_configured',
      error: warningMsg
    };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser.trim(),
      pass: emailPass.replace(/\s+/g, '')
    }
  });

  const formattedDate = new Date(delivery.created_at || Date.now()).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const sourceLabel = delivery.source === 'wheel' ? '🎡 Gain Roue de la Fortune' : '🛍️ Échange Boutique BDE';
  const displayName = delivery.variant_name
    ? `${delivery.item_name} (${delivery.variant_name})`
    : delivery.item_name;

  const subject = oneLine(`[Marsabet BDE] Nouvelle demande de livraison : ${displayName} — ${delivery.room_location} (${delivery.first_name} ${delivery.last_name})`);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="fr">
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #040E24; color: #FFFFFF; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: #0A1F44; border: 2px solid #D4AF37; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0A1F44 0%, #153775 100%); padding: 25px 20px; text-align: center; border-bottom: 2px solid #D4AF37;">
          <h1 style="color: #FDE047; font-size: 22px; margin: 0; text-transform: uppercase; letter-spacing: 1px;">
            🚀 Demande de Livraison Directe Marsabet
          </h1>
          <p style="color: #CBD5E1; font-size: 14px; margin: 8px 0 0;">
            Un élève a validé une commande et attend sa livraison sur le campus !
          </p>
        </div>

        <!-- Corps de l'email -->
        <div style="padding: 25px;">

          <!-- Carte Destinataire -->
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(212, 175, 55, 0.35); border-left: 5px solid #D4AF37; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
            <h2 style="color: #FDE047; font-size: 16px; margin: 0 0 12px; display: flex; align-items: center;">
              📍 Où livrer la commande ?
            </h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
              <tr>
                <td style="padding: 6px 0; color: #94A3B8; width: 140px;">Élève :</td>
                <td style="padding: 6px 0; font-weight: bold; color: #FFFFFF;">${esc(delivery.first_name)} ${esc(delivery.last_name)} (${esc(delivery.username || 'Élève')})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Salle / Lieu :</td>
                <td style="padding: 6px 0; font-weight: bold; color: #38BDF8; font-size: 16px;">
                  🏛️ <span style="background: rgba(56, 189, 248, 0.2); padding: 3px 8px; border-radius: 4px; border: 1px solid #38BDF8;">${esc(delivery.room_location)}</span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Téléphone :</td>
                <td style="padding: 6px 0; font-weight: bold; color: #FFFFFF;">
                  ${cleanPhone(delivery.phone) ? `📞 <a href="tel:${esc(cleanPhone(delivery.phone))}" style="color: #FDE047; text-decoration: none;">${esc(cleanPhone(delivery.phone))}</a>` : '<em>Non renseigné</em>'}
                </td>
              </tr>
            </table>
          </div>

          <!-- Carte Produit -->
          <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(56, 189, 248, 0.35); border-left: 5px solid #38BDF8; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
            <h2 style="color: #38BDF8; font-size: 16px; margin: 0 0 12px;">
              📦 Produit demandé
            </h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
              <tr>
                <td style="padding: 6px 0; color: #94A3B8; width: 140px;">Produit :</td>
                <td style="padding: 6px 0; font-weight: bold; color: #FFFFFF; font-size: 16px;">${esc(displayName)}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Quantité :</td>
                <td style="padding: 6px 0; font-weight: bold; color: #FFFFFF;">${delivery.quantity || 1}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Origine :</td>
                <td style="padding: 6px 0; color: #CBD5E1;">${sourceLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94A3B8;">Coins déduits :</td>
                <td style="padding: 6px 0; color: #FDE047; font-weight: bold;">
                  ${delivery.coins_paid > 0 ? `${delivery.coins_paid.toLocaleString()} 🪙` : '0 🪙 (Lot Gratuit)'}
                </td>
              </tr>
            </table>
          </div>

          <!-- Précision / Remarque de l'élève si fournie -->
          ${delivery.notes ? `
          <div style="background: rgba(253, 224, 71, 0.08); border: 1px solid rgba(253, 224, 71, 0.4); border-left: 5px solid #FDE047; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
            <h2 style="color: #FDE047; font-size: 16px; margin: 0 0 10px;">
              📝 Précision / Remarque de l'élève
            </h2>
            <div style="color: #FFFFFF; font-size: 15px; line-height: 1.5; white-space: pre-wrap; background: rgba(0, 0, 0, 0.25); padding: 10px 14px; border-radius: 6px;">
              ${esc(delivery.notes)}
            </div>
          </div>
          ` : ''}

          <!-- Informations système -->
          <div style="font-size: 12px; color: #64748B; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 15px; margin-top: 20px; line-height: 1.5;">
            🕒 Date de la demande : <strong>${formattedDate}</strong><br>
            🆔 Commande n° : <strong>#${delivery.id}</strong><br>
            Plateforme : <strong>Marsabet Casino Virtuel BDE Epitech Marseille</strong>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
[MARSABET BDE] NOUVELLE DEMANDE DE LIVRAISON DIRECTE
==================================================

DESTINATAIRE :
- Nom & Prénom : ${delivery.first_name} ${delivery.last_name} (${delivery.username || 'Élève'})
- SALLE / LIEU : ${delivery.room_location}
- Téléphone : ${delivery.phone || 'Non renseigné'}
${delivery.notes ? `- Précision / Remarque : ${delivery.notes}\n` : ''}
COMMANDE :
- Produit : ${displayName}
- Quantité : ${delivery.quantity || 1}
- Origine : ${sourceLabel}
- Coins déduits : ${delivery.coins_paid > 0 ? `${delivery.coins_paid.toLocaleString()} coins` : '0 coin (Lot Gratuit)'}

Date : ${formattedDate}
Commande n° : #${delivery.id}
  `.trim();

  try {
    const info = await transporter.sendMail({
      from: `"Marsabet Casino BDE" <${emailUser}>`,
      to: bdeEmail,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`[EmailService] ✅ Email de livraison #${delivery.id} envoyé avec succès à ${bdeEmail} (Message ID: ${info.messageId})`);
    return {
      success: true,
      status: 'sent',
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[EmailService] ❌ Erreur lors de l'envoi de l'email pour la livraison #${delivery.id}:`, err.message);
    return {
      success: false,
      status: 'failed',
      error: err.message
    };
  }
}

async function sendVerificationEmail(email, code, username = '') {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    // Code affiché dans la console uniquement en développement (jamais en production : les logs ne sont pas secrets)
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[EmailService] ⚠️ Identifiants Gmail non configurés. Code de ${username} (${email}) : ${code}`);
    } else {
      console.warn('[EmailService] ⚠️ EMAIL_USER / EMAIL_PASS non configurés : impossible d\'envoyer le code de vérification.');
    }
    return {
      success: true,
      status: 'dev_logged'
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser.trim(),
        pass: emailPass.replace(/\s+/g, '')
      }
    });

    const subject = `[Marsabet] Ton code de validation : ${code}`;
    const textContent = `Salut ${username || 'Astronaute'} !\n\nBienvenue sur Marsabet, le casino étudiant du BDE.\n\nTon code de confirmation pour activer ton compte et recevoir tes 5 000 jetons est :\n\n${code}\n\nCe code expire dans 15 minutes.\n\nÀ très vite sur Marsabet !`;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #040E24; color: #FFFFFF; padding: 20px; margin: 0;">
        <div style="max-width: 540px; margin: 0 auto; background: #0A1F44; border: 2px solid #D4AF37; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div style="background: linear-gradient(135deg, #0A1F44 0%, #153775 100%); padding: 25px 20px; text-align: center; border-bottom: 2px solid #D4AF37;">
            <div style="font-size: 2.5rem; margin-bottom: 6px;">🪐</div>
            <h1 style="color: #FDE047; font-size: 24px; margin: 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 800;">
              Marsabet Casino
            </h1>
            <p style="color: #CBD5E1; font-size: 14px; margin: 6px 0 0;">
              Activation de ton compte étudiant Epitech
            </p>
          </div>
          <div style="padding: 28px 24px; text-align: center;">
            <p style="font-size: 16px; color: #E2E8F0; margin-top: 0;">
              Salut <strong style="color: #FDE047;">${esc(username || 'Astronaute')}</strong> ! 👋
            </p>
            <p style="font-size: 14.5px; color: #94A3B8; line-height: 1.5; margin-bottom: 24px;">
              Pour finaliser ton inscription et débloquer tes <strong>5 000 jetons</strong> de bienvenue, saisis ce code de confirmation sur Marsabet :
            </p>
            <div style="background: rgba(255, 255, 255, 0.05); border: 2px dashed #D4AF37; border-radius: 10px; padding: 18px 24px; display: inline-block; margin-bottom: 24px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #FDE047; margin-bottom: 6px; font-weight: 700;">Code de vérification</div>
              <div style="font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #FFFFFF; font-family: 'Courier New', Courier, monospace;">
                ${code}
              </div>
            </div>
            <p style="font-size: 13px; color: #64748B; margin-bottom: 0;">
              ⏳ Ce code est valable pendant 15 minutes.<br>Si tu n'es pas à l'origine de cette demande, ignore simplement ce message.
            </p>
          </div>
          <div style="background: #06142B; padding: 14px 20px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 12px; color: #64748B;">
            Marsabet — Plateforme BDE Epitech Marseille
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await transporter.sendMail({
      from: `"Marsabet Casino" <${emailUser}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent
    });

    console.log(`[EmailService] ✅ Email de validation envoyé à ${email} (Message ID: ${info.messageId})`);
    return {
      success: true,
      status: 'sent',
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[EmailService] ❌ Erreur lors de l'envoi de l'email à ${email}:`, err.message);
    return {
      success: true,
      status: 'fallback_logged',
      error: err.message
    };
  }
}

module.exports = {
  sendDeliveryNotification,
  sendVerificationEmail
};
