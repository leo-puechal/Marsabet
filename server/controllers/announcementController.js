const db = require('../database/db');

// Récupérer toutes les annonces pour l'administration BDE avec statistiques de vues
exports.adminGetAnnouncements = (req, res) => {
  try {
    const rawAnnouncements = db.prepare(`
      SELECT a.id, a.title, a.content, a.is_active, a.expires_at, a.created_at, a.updated_at,
             u.username as created_by_username,
             (SELECT COUNT(*) FROM user_announcement_views uav WHERE uav.announcement_id = a.id) as views_count
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `).all();

    const studentCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role NOT IN ('admin')").get();
    const totalStudents = studentCountRow ? studentCountRow.count : 0;

    const announcements = rawAnnouncements.map(ann => {
      const isExpired = ann.expires_at ? new Date(ann.expires_at) <= new Date() : false;
      return {
        ...ann,
        is_active: Boolean(ann.is_active),
        is_expired: isExpired,
        views_count: ann.views_count || 0,
        total_students: totalStudents,
        percentage_viewed: totalStudents > 0 ? Math.round(((ann.views_count || 0) / totalStudents) * 100) : 0
      };
    });

    return res.json({
      announcements,
      totalStudents
    });
  } catch (err) {
    console.error('Erreur adminGetAnnouncements:', err);
    return res.status(500).json({ error: 'Impossible de récupérer la liste des annonces.' });
  }
};

// Créer une nouvelle annonce officielle BDE
exports.adminCreateAnnouncement = (req, res) => {
  try {
    const { title, content, expires_at, is_active = 1 } = req.body;
    let adminId = req.user ? req.user.id : null;
    if (adminId) {
      const u = db.prepare('SELECT id FROM users WHERE id = ?').get(adminId);
      if (!u) adminId = null;
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Le titre de l\'annonce est obligatoire.' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu du message est obligatoire.' });
    }

    const cleanTitle = title.trim();
    const cleanContent = content.trim();

    let cleanExpiresAt = null;
    if (expires_at && typeof expires_at === 'string' && expires_at.trim()) {
      const d = new Date(expires_at.trim());
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Format de date d\'expiration invalide.' });
      }
      cleanExpiresAt = d.toISOString();
    }

    const activeVal = (is_active === 0 || is_active === false || is_active === '0') ? 0 : 1;

    const insert = db.prepare(`
      INSERT INTO announcements (title, content, is_active, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = insert.run(cleanTitle, cleanContent, activeVal, cleanExpiresAt, adminId);

    const created = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Annonce publiée avec succès !',
      announcement: created
    });
  } catch (err) {
    console.error('Erreur adminCreateAnnouncement:', err);
    return res.status(500).json({ error: 'Erreur lors de la publication de l\'annonce.' });
  }
};

// Mettre à jour une annonce existante
exports.adminUpdateAnnouncement = (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, expires_at, is_active } = req.body;

    const existing = db.prepare('SELECT id FROM announcements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Annonce introuvable.' });
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Le titre de l\'annonce est obligatoire.' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'Le contenu du message est obligatoire.' });
    }

    let cleanExpiresAt = null;
    if (expires_at && typeof expires_at === 'string' && expires_at.trim()) {
      const d = new Date(expires_at.trim());
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: 'Format de date d\'expiration invalide.' });
      }
      cleanExpiresAt = d.toISOString();
    }

    const activeVal = (is_active === 0 || is_active === false || is_active === '0') ? 0 : 1;

    db.prepare(`
      UPDATE announcements
      SET title = ?, content = ?, is_active = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title.trim(), content.trim(), activeVal, cleanExpiresAt, id);

    const updated = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);

    return res.json({
      success: true,
      message: 'Annonce mise à jour avec succès !',
      announcement: updated
    });
  } catch (err) {
    console.error('Erreur adminUpdateAnnouncement:', err);
    return res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'annonce.' });
  }
};

// Activer / désactiver une annonce
exports.adminToggleAnnouncement = (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id, is_active, title FROM announcements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Annonce introuvable.' });
    }

    const newStatus = existing.is_active ? 0 : 1;
    db.prepare('UPDATE announcements SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, id);

    return res.json({
      success: true,
      message: `Annonce "${existing.title}" ${newStatus ? 'activée' : 'désactivée'}.`,
      is_active: Boolean(newStatus)
    });
  } catch (err) {
    console.error('Erreur adminToggleAnnouncement:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'activation/désactivation de l\'annonce.' });
  }
};

// Supprimer définitivement une annonce
exports.adminDeleteAnnouncement = (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id, title FROM announcements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Annonce introuvable.' });
    }

    db.transaction(() => {
      db.prepare('DELETE FROM user_announcement_views WHERE announcement_id = ?').run(id);
      db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    })();

    return res.json({
      success: true,
      message: `Annonce "${existing.title}" supprimée définitivement.`
    });
  } catch (err) {
    console.error('Erreur adminDeleteAnnouncement:', err);
    return res.status(500).json({ error: 'Erreur lors de la suppression de l\'annonce.' });
  }
};

// ========================================================
// SECTION ÉLÈVE : RÉCUPÉRATION ET ACQUITTEMENT DES ANNONCES
// ========================================================

// Récupérer les annonces actives et non expirées que l'élève n'a pas encore vues
// STRICTEMENT dans l'ordre chronologique de création (ORDER BY created_at ASC)
exports.getUnreadAnnouncements = (req, res) => {
  try {
    const userId = req.user.id;

    const announcements = db.prepare(`
      SELECT a.id, a.title, a.content, a.expires_at, a.created_at
      FROM announcements a
      WHERE a.is_active = 1
        AND (a.expires_at IS NULL OR datetime(a.expires_at) > datetime('now'))
        AND a.id NOT IN (
          SELECT uav.announcement_id
          FROM user_announcement_views uav
          WHERE uav.user_id = ?
        )
      ORDER BY a.created_at ASC
    `).all(userId);

    return res.json({
      announcements
    });
  } catch (err) {
    console.error('Erreur getUnreadAnnouncements:', err);
    return res.status(500).json({ error: 'Impossible de récupérer les annonces.' });
  }
};

// Marquer une annonce comme vue par l'élève connecté (clic sur "J'ai compris")
exports.markAnnouncementViewed = (req, res) => {
  try {
    const userId = req.user.id;
    const announcementId = req.params.id;

    if (!announcementId) {
      return res.status(400).json({ error: 'Identifiant d\'annonce manquant.' });
    }

    const ann = db.prepare('SELECT id FROM announcements WHERE id = ?').get(announcementId);
    if (!ann) {
      return res.status(404).json({ error: 'Annonce introuvable.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO user_announcement_views (user_id, announcement_id, viewed_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(userId, announcementId);

    return res.json({
      success: true,
      message: 'Annonce marquée comme lue.'
    });
  } catch (err) {
    console.error('Erreur markAnnouncementViewed:', err);
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la lecture.' });
  }
};
