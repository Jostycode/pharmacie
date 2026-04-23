const router = require("express").Router();
const pool = require("../db");

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
      COALESCE(p.montant_verse, 0)::numeric AS deja_paye,
      -- Calcul du TOTAL DU (Consultation + Examens)
      (COALESCE(p.montant, 0)::numeric + COALESCE(SUM(del.prix_applique), 0)::numeric) AS montant_initial,
      -- Calcul du RESTE
      ((COALESCE(p.montant, 0)::numeric + COALESCE(SUM(del.prix_applique), 0)::numeric) - COALESCE(p.montant_verse, 0)::numeric) AS montant_restant
    FROM patient p
    LEFT JOIN demande_examen de ON p.id_patient = de.id_patient 
      AND de.statut IN ('en_attente', 'validé', 'nouveau')
    LEFT JOIN demande_examen_ligne del ON de.id_demande = del.id_demande
    GROUP BY p.id_patient, p.nom, p.prenom, p.telephone, p.consultation, p.date_creation, p.montant, p.montant_verse, p.statut_paye
    HAVING ((COALESCE(p.montant, 0)::numeric + COALESCE(SUM(del.prix_applique), 0)::numeric) - COALESCE(p.montant_verse, 0)::numeric) > 0
    ORDER BY p.date_creation DESC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("DÉTAIL ERREUR SQL CAISSE:", err.message);
    res.status(500).json({ error: "Erreur lors du calcul des montants de caisse" });
  }
});

router.put("/payer/:id", async (req, res) => {
  const { id } = req.params;
  const { nouveau_versement, total_du } = req.body; // total_du est le montant total de l'acte

  try {
    // 1. On récupère ce que le patient a déjà payé
    const patientCheck = await pool.query("SELECT montant_verse FROM patient WHERE id_patient = $1", [id]);
    const deja_paye = parseFloat(patientCheck.rows[0].montant_verse || 0);
    
    // 2. Nouveau total versé
    const cumul_verse = deja_paye + parseFloat(nouveau_versement || 0);
    
    // 3. Détermination du statut
    let statut = 'non payé';
    if (cumul_verse >= parseFloat(total_du)) {
      statut = 'payé';
    } else if (cumul_verse > 0) {
      statut = 'avance';
    }

    await pool.query(
      "UPDATE patient SET montant_verse = $1, statut_paye = $2 WHERE id_patient = $3",
      [cumul_verse, statut, id]
    );

    res.json({ message: "Paiement enregistré", cumul_verse, statut });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Erreur serveur lors du paiement" });
  }
});

module.exports = router;