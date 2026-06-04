const router = require("express").Router();
const pool = require("../db");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// --- 1. CRÉATION D'UNE VENTE (POST) ---
// Gère le passage en caisse, le déstockage intelligent par lot (FEFO) et l'historique
router.post("/", async (req, res) => {
  // Modification ici : on cherche dans le body OU dans les headers
  const id_structure = req.body.id_structure || req.headers["id_structure"];
  const { id_utilisateur, mode_paiement, articles } = req.body;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }
  if (!articles || articles.length === 0) {
    return res.status(400).json({ error: "Aucun article sélectionné pour la vente." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let totalSommeVente = 0;
    const detailsAInserer = [];

    // Boucle sur chaque article demandé à la caisse
    for (const article of articles) {
      const { id_produit, quantite: quantiteDemandee } = article;
      let quantiteRestanteAEnlever = quantiteDemandee;

      // 1. Récupérer le prix unitaire actuel du produit pour cette structure
      const prodRes = await client.query(
        "SELECT prix_vente_unitaire, nom FROM produits WHERE id_produit = $1 AND id_structure = $2",
        [id_produit, id_structure]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Produit introuvable ou non autorisé.`);
      }

      const prixVenteUnitaire = parseFloat(prodRes.rows[0].prix_vente_unitaire);
      const nomProduit = prodRes.rows[0].nom;

      // 2. Récupérer les lots disponibles pour ce produit, triés par date de péremption la plus proche (FEFO)
      const lotsRes = await client.query(
        `SELECT id_lot, quantite_disponible, date_peremption 
         FROM lots_stock 
         WHERE id_produit = $1 AND id_structure = $2 AND quantite_disponible > 0 AND date_peremption >= CURRENT_DATE
         ORDER BY date_peremption ASC`,
        [id_produit, id_structure]
      );

      // Calculer le stock total disponible toutes dates confondues
      const stockTotalDisponible = lotsRes.rows.reduce((sum, row) => sum + row.quantite_disponible, 0);

      if (stockTotalDisponible < quantiteDemandee) {
        throw new Error(`Stock insuffisant pour le produit : ${nomProduit}. Disponible: ${stockTotalDisponible}, Demandé: ${quantiteDemandee}`);
      }

      // 3. Vider les lots un par un jusqu'à satisfaction de la quantité demandée
      for (const lot of lotsRes.rows) {
        if (quantiteRestanteAEnlever <= 0) break;

        const quantitePriseDansCeLot = Math.min(lot.quantite_disponible, quantiteRestanteAEnlever);
        
        // Mettre à jour le lot en diminuant sa quantité disponible
        await client.query(
          "UPDATE lots_stock SET quantite_disponible = quantite_disponible - $1 WHERE id_lot = $2",
          [quantitePriseDansCeLot, lot.id_lot]
        );

        // Préparer les données pour l'insertion dans details_vente
        detailsAInserer.push({
          id_produit,
          id_lot: lot.id_lot,
          quantite: quantitePriseDansCeLot,
          prix_unitaire_vendu: prixVenteUnitaire
        });

        // Cumuler le prix total global de la vente
        totalSommeVente += quantitePriseDansCeLot * prixVenteUnitaire;
        quantiteRestanteAEnlever -= quantitePriseDansCeLot;
      }
    }

    // 4. Insérer la Vente principale
    const textVente = `
      INSERT INTO ventes (id_structure, id_utilisateur, total_somme, mode_paiement) 
      VALUES ($1, $2, $3, $4) RETURNING *`;
    const venteRes = await client.query(textVente, [
      id_structure, 
      id_utilisateur || null, 
      totalSommeVente, 
      mode_paiement || "ESPECES"
    ]);
    const nouvelleVente = venteRes.rows[0];

    // 5. Insérer toutes les lignes de détails rattachées à cette vente (votre table details_vente)
    const textDetail = `
      INSERT INTO details_vente (id_vente, id_produit, id_lot, quantite, prix_unitaire_vendu) 
      VALUES ($1, $2, $3, $4, $5)`;
      
    for (const detail of detailsAInserer) {
      await client.query(textDetail, [
        nouvelleVente.id_vente, 
        detail.id_produit, 
        detail.id_lot, 
        detail.quantite, 
        detail.prix_unitaire_vendu
      ]);
    }

    await client.query("COMMIT");
    notifyRefresh(req);

    // Retourne le succès ainsi que l'ID généré pour ouvrir le ticket instantanément à l'écran
    res.status(201).json({ 
      success: true, 
      message: "Vente validée et stock mis à jour avec succès.", 
      id_vente: nouvelleVente.id_vente,
      total: totalSommeVente,
      mode_paiement: nouvelleVente.mode_paiement,
      date_vente: nouvelleVente.date_vente
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur DB POST Vente:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- 2. LIRE TOUTES LES VENTES DE LA STRUCTURE (GET ALL) ---
router.get("/", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const query = `
      SELECT v.*, u.nom_utilisateur 
      FROM ventes v
      LEFT JOIN utilisateurs u ON v.id_utilisateur = u.id_utilisateur
      WHERE v.id_structure = $1 
      ORDER BY v.date_vente DESC`;
      
    const r = await pool.query(query, [id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Ventes :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. LIRE LES LIGNES DE DÉTAILS D'UNE VENTE SPECIFIQUE (GET DETAILS POUR FACTURE) ---
// Cette route est appelée par `handleOuvrirFacture` dans votre interface React
router.get("/details/:id_vente", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id_vente } = req.params;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    // Requête SQL avec jointure pour obtenir le nom du médicament et le lot sur le reçu
    const query = `
      SELECT 
        dv.id_detail_vente,
        dv.id_vente,
        dv.id_produit,
        dv.id_lot,
        dv.quantite,
        dv.prix_unitaire_vendu,
        p.nom AS nom_produit,
        l.id_lot
      FROM details_vente dv
      JOIN produits p ON dv.id_produit = p.id_produit
      LEFT JOIN lots_stock l ON dv.id_lot = l.id_lot
      JOIN ventes v ON dv.id_vente = v.id_vente
      WHERE dv.id_vente = $1 AND v.id_structure = $2`;

    const r = await pool.query(query, [id_vente, id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET details_vente :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 4. ANNULATION COMPLÈTE D'UNE VENTE (DELETE) ---
// Restitue proprement les quantités vendues dans les lots d'origine (anti-gaspillage FEFO)
router.delete("/annuler/:id", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id } = req.params;

  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Vérifier la cohérence de la vente
    const checkVente = await client.query(
      "SELECT id_vente FROM ventes WHERE id_vente = $1 AND id_structure = $2", 
      [id, id_structure]
    );

    if (checkVente.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Vente introuvable ou accès non autorisé." });
    }

    // Récupérer les lignes de détails pour restaurer le stock initial
    const lignesRes = await client.query(
      "SELECT id_lot, quantite FROM details_vente WHERE id_vente = $1", 
      [id]
    );

    for (const ligne of lignesRes.rows) {
      if (ligne.id_lot) {
        await client.query(
          "UPDATE lots_stock SET quantite_disponible = quantite_disponible + $1 WHERE id_lot = $2",
          [ligne.quantite, ligne.id_lot]
        );
      }
    }

    // Supprimer la vente principale. 
    // Si votre clé étrangère possède un "ON DELETE CASCADE", les détails associés sauteront automatiquement.
    await client.query("DELETE FROM ventes WHERE id_vente = $1 AND id_structure = $2", [id, id_structure]);

    await client.query("COMMIT");
    notifyRefresh(req);
    res.json({ success: true, message: "Vente annulée avec succès et stocks réajustés." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erreur Annulation Vente:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;