const router = require("express").Router();
const pool = require("../db");

// Remplace ta route router.get("/") par celle-ci
router.get("/", async (req, res) => {
  try {
    const query = `
    SELECT 
      p.id_patient,
      p.nom,
      p.prenom,
      p.telephone,
      p.consultation,
      p.date_creation,
      p.statut_paye,
      COALESCE(p.montant, 0)::numeric AS prix_consultation,
      COALESCE(p.montant_verse, 0)::numeric AS deja_paye,
      -- Liste détaillée des examens (JSON)
      COALESCE(
        json_agg(
          json_build_object('nom', ex.nom_examen, 'prix', del.prix_applique)
        ) FILTER (WHERE ex.nom_examen IS NOT NULL), 
        '[]'
      ) AS details_examens,
      -- Calcul du TOTAL DU
      (COALESCE(p.montant, 0)::numeric + COALESCE(SUM(del.prix_applique), 0)::numeric) AS montant_initial,
      -- Calcul du RESTE
      ((COALESCE(p.montant, 0)::numeric + COALESCE(SUM(del.prix_applique), 0)::numeric) - COALESCE(p.montant_verse, 0)::numeric) AS montant_restant
    FROM patient p
    LEFT JOIN demande_examen de ON p.id_patient = de.id_patient AND de.statut IN ('validé', 'nouveau')
    LEFT JOIN demande_examen_ligne del ON de.id_demande = del.id_demande
    LEFT JOIN examen ex ON del.id_examen = ex.id_examen
    
    -- LA CORRECTION EST ICI :
    WHERE (p.est_actif IS NOT FALSE) 
    
    GROUP BY p.id_patient, p.nom, p.prenom, p.telephone, p.consultation, p.date_creation, p.montant, p.montant_verse, p.statut_paye
    HAVING ((COALESCE(p.montant, 0)::numeric + COALESCE(SUM(del.prix_applique), 0)::numeric) - COALESCE(p.montant_verse, 0)::numeric) > 0
    ORDER BY p.date_creation DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur SQL Caisse" });
  }
});

module.exports = router;