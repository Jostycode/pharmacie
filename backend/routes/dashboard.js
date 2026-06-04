const router = require("express").Router();
const pool = require("../db");

router.get("/stats", async (req, res) => {
  const id_structure = req.headers["id_structure"] || req.query.id_structure;
  const { startDate, endDate } = req.query;

  if (!id_structure) {
    return res.status(400).json({ error: "L'identifiant de la structure est requis." });
  }

  try {
    // 1. Calcul du Chiffre d'affaires global (filtré par date si spécifié)
    let caQuery = `SELECT COALESCE(SUM(total_somme), 0) AS ca_jour FROM ventes WHERE id_structure = $1`;
    let caParams = [id_structure];

    if (startDate && endDate) {
      caQuery += ` AND date_vente::date BETWEEN $2 AND $3`;
      caParams.push(startDate, endDate);
    } else {
      caQuery += ` AND date_vente::date = CURRENT_DATE`;
    }
    const caJrnRes = await pool.query(caQuery, caParams);


    // 1.B : Liste détaillée des articles vendus pour la modale
    let detailVentesQuery = `
      SELECT 
        v.date_vente, 
        v.mode_paiement, 
        dv.quantite, 
        dv.prix_unitaire_vendu, 
        p.nom AS nom_produit
      FROM details_vente dv
      JOIN ventes v ON dv.id_vente = v.id_vente
      JOIN produits p ON dv.id_produit = p.id_produit
      WHERE v.id_structure = $1
    `;
    let detailVentesParams = [id_structure];

    if (startDate && endDate) {
      detailVentesQuery += ` AND v.date_vente::date BETWEEN $2 AND $3`;
      detailVentesParams.push(startDate, endDate);
    } else {
      detailVentesQuery += ` AND v.date_vente::date = CURRENT_DATE`;
    }
    detailVentesQuery += ` ORDER BY v.date_vente DESC`;
    const listeVentesDetailsRes = await pool.query(detailVentesQuery, detailVentesParams);


    // 2. Ruptures de stock
    const listeRupturesRes = await pool.query(
      `SELECT p.nom 
       FROM produits p
       LEFT JOIN lots_stock l ON p.id_produit = l.id_produit AND l.date_peremption >= CURRENT_DATE
       WHERE p.id_structure = $1
       GROUP BY p.id_produit, p.nom
       HAVING COALESCE(SUM(l.quantite_disponible), 0) = 0`,
      [id_structure]
    );

    // 3. Lots critiques (CORRIGÉ : l.id_lot à la place de l.numero_lot)
    const EastonCritiquesRes = await pool.query(
      `SELECT l.id_lot, l.quantite_disponible, l.date_peremption, p.nom AS nom_produit
       FROM lots_stock l
       JOIN produits p ON l.id_produit = p.id_produit
       WHERE l.id_structure = $1 AND l.quantite_disponible > 0 AND l.date_peremption <= CURRENT_DATE + INTERVAL '30 days'
       ORDER BY l.date_peremption ASC`,
      [id_structure]
    );

    // 4. Évolution du CA (sur 7 jours glissants)
    let baseDate = "CURRENT_DATE";
    if (endDate) baseDate = `'${endDate}'::date`;

    const evolutionCaRes = await pool.query(
      `SELECT 
         jours.date AS date_vente,
         COALESCE(SUM(v.total_somme), 0) AS total_ventes
       FROM (
         SELECT generate_series(${baseDate} - INTERVAL '6 days', ${baseDate}, '1 day')::date AS date
       ) jours
       LEFT JOIN ventes v ON v.date_vente::date = jours.date AND v.id_structure = $1
       GROUP BY jours.date
       ORDER BY jours.date ASC`,
      [id_structure]
    );

    // 5. Top 5 des médicaments
    const topVentesRes = await pool.query(
      `SELECT p.nom, COALESCE(SUM(dv.quantite), 0)::int AS quantite_vendue
       FROM details_vente dv
       JOIN produits p ON dv.id_produit = p.id_produit
       JOIN ventes v ON dv.id_vente = v.id_vente
       WHERE v.id_structure = $1
       GROUP BY p.id_produit, p.nom
       ORDER BY quantite_vendue DESC
       LIMIT 5`,
      [id_structure]
    );

    // Retour des résultats au client
    res.json({
      indicateurs: {
        ca_aujourdhui: parseFloat(caJrnRes.rows[0].ca_jour),
        produits_rupture: listeRupturesRes.rowCount,
        lots_critiques: EastonCritiquesRes.rowCount
      },
      liste_ventes_details: listeVentesDetailsRes.rows,
      liste_ruptures: listeRupturesRes.rows,
      liste_critiques: EastonCritiquesRes.rows,
      evolution_ca: evolutionCaRes.rows,
      top_ventes: topVentesRes.rows
    });

  } catch (err) {
    console.error("Erreur GET Dashboard Stats:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;