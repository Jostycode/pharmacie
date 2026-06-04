const router = require("express").Router();
const pool = require("../db");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// --- 1. AJOUTER UN PRODUIT AU CATALOGUE (POST) ---
router.post("/", async (req, res) => {
  const { id_structure, nom, prix_vente_unitaire, stock_alerte } = req.body;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }
  if (!nom || !prix_vente_unitaire) {
    return res.status(400).json({ error: "Le nom et le prix de vente sont obligatoires." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO produits (id_structure, nom, prix_vente_unitaire, stock_alerte) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_structure, nom, prix_vente_unitaire, stock_alerte || 5]
    );

    notifyRefresh(req);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Erreur DB POST Produit:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 2. LIRE TOUS LES PRODUITS AVEC LEUR STOCK TOTAL (GET ALL) ---
// Cette requête fait un calcul automatique (SUM) de toutes les quantités disponibles dans les lots
router.get("/", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const query = `
      SELECT 
        p.id_produit, 
        p.nom, 
        p.prix_vente_unitaire, 
        p.stock_alerte,
        COALESCE(SUM(l.quantite_disponible), 0) AS stock_total
      FROM produits p
      LEFT JOIN lots_stock l ON p.id_produit = l.id_produit AND l.date_peremption >= CURRENT_DATE
      WHERE p.id_structure = $1
      GROUP BY p.id_produit
      ORDER BY p.nom ASC`;

    const r = await pool.query(query, [id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Produits :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. LIRE LES PRODUITS EN ALERTE DE STOCK (GET ALERTES) ---
// Pratique pour le tableau de bord du pharmacien (affiche les produits dont le stock < stock_alerte)
router.get("/alertes", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const query = `
      SELECT * FROM (
        SELECT 
          p.id_produit, 
          p.nom, 
          p.stock_alerte,
          COALESCE(SUM(l.quantite_disponible), 0) AS stock_total
        FROM produits p
        LEFT JOIN lots_stock l ON p.id_produit = l.id_produit AND l.date_peremption >= CURRENT_DATE
        WHERE p.id_structure = $1
        GROUP BY p.id_produit
      ) as inventaire
      WHERE stock_total <= stock_alerte
      ORDER BY stock_total ASC`;

    const r = await pool.query(query, [id_structure]);
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Alertes Produits :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 4. LIRE UN SEUL PRODUIT (GET ONE) ---
router.get("/:id", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id } = req.params;
  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const r = await pool.query(
      "SELECT * FROM produits WHERE id_produit = $1 AND id_structure = $2", 
      [id, id_structure]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: "Produit introuvable." });
    res.json(r.rows[0]);
  } catch (err) {
    console.error("Erreur GET One Produit :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 5. MODIFIER UN PRODUIT (PUT) ---
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, prix_vente_unitaire, stock_alerte, id_structure } = req.body;

  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const result = await pool.query(
      `UPDATE produits SET nom = $1, prix_vente_unitaire = $2, stock_alerte = $3 
       WHERE id_produit = $4 AND id_structure = $5 RETURNING *`,
      [nom, prix_vente_unitaire, stock_alerte, id, id_structure]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Produit non trouvé ou accès non autorisé." });
    }

    notifyRefresh(req);
    res.json({ message: "Produit mis à jour avec succès", produit: result.rows[0] });
  } catch (err) {
    console.error("Erreur DB PUT Produit:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 6. SUPPRIMER UN PRODUIT (DELETE) ---
router.delete("/delete/:id", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { id } = req.params;

  if (!id_structure) return res.status(400).json({ error: "L'identifiant de la structure est requis." });

  try {
    const result = await pool.query(
      "DELETE FROM produits WHERE id_produit = $1 AND id_structure = $2 RETURNING *", 
      [id, id_structure]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Produit non trouvé ou action non autorisée." });
    }

    notifyRefresh(req);
    res.json({ success: true, message: "Produit supprimé du catalogue ainsi que ses lots associés par cascade." });
  } catch (err) {
    console.error("Erreur DB DELETE Produit:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;