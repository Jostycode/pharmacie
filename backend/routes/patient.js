const router = require("express").Router();
const pool = require("../db");

 
// --- CRÉATION (POST) ---
router.post("/post", async (req, res) => {
  const { nom, prenom, telephone, consultation, sexe } = req.body;

  try {
    // 1. Calcul du prix
    const priceRes = await pool.query(
      "SELECT prix FROM consultation WHERE LOWER(nom_consul) = LOWER($1)",
      [consultation]
    );
    const montantConsultation = priceRes.rows.length > 0 ? priceRes.rows[0].prix : 0;

    // 2. Insertion (On ne liste que les colonnes fournies, la DB gère le reste)
    const result = await pool.query(
      `INSERT INTO patient (nom, prenom, telephone, consultation, sexe, montant) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nom, prenom, telephone, consultation, sexe, montantConsultation]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Erreur DB POST:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- MISE À JOUR (PUT) ---
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  // On définit des valeurs par défaut pour éviter le plantage si le front ne les envoie pas
  const { 
    nom, prenom, telephone, consultation, sexe,
    age = 0, poids = "0", tension = "N/A", 
    temperature = "N/A", saturation = "N/A" 
  } = req.body;

  try {
    // 1. Recalculer le prix
    const priceRes = await pool.query(
      "SELECT prix FROM consultation WHERE LOWER(nom_consul) = LOWER($1)",
      [consultation]
    );
    const nouveauMontant = priceRes.rows.length > 0 ? priceRes.rows[0].prix : 0;

    // 2. Mettre à jour
    await pool.query(
      `UPDATE patient SET 
       nom=$1, prenom=$2, telephone=$3, consultation=$4, age=$5, sexe=$6, 
       poids=$7, tension=$8, temperature=$9, saturation=$10, montant=$11 
       WHERE id_patient=$12`,
      [nom, prenom, telephone, consultation, age, sexe, poids, tension, temperature, saturation, nouveauMontant, id]
    );

    res.json({ message: "Patient mis à jour avec succès" });
  } catch (err) {
    console.error("Erreur DB PUT:", err.message);
    res.status(500).json({ error: err.message });
  }
});
/// READ ALL
router.get("/", async (req, res) => {
  const r = await pool.query(`SELECT * FROM patient ORDER BY date_creation DESC`);
  res.json(r.rows);
});

/// READ ONE
router.get("/:id", async (req, res) => {
  const r = await pool.query(`SELECT * FROM patient WHERE id_patient=$1`, [req.params.id]);
  res.json(r.rows[0]);
});

/// UPDATE


/// DELETE
// --- 1. SUPPRESSION ADMINISTRATIVE (Archivage) ---
// On ne supprime rien, on change juste un statut (ex: actif = false)
router.patch("/archive/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { statut } = req.body; 

    const result = await pool.query(
      "UPDATE patient SET est_actif = $1 WHERE id_patient = $2 RETURNING *",
      [statut, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Patient non trouvé" });
    }

    // Émettre l'update pour rafraîchir tous les clients connectés
    if (req.io) req.io.emit("patients_updated"); 

    res.json({ success: true, message: "Statut mis à jour" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur: " + err.message });
  }
});

// --- 2. DELETE COMPLET CORRIGÉ ---
router.delete("/full-delete/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const patientId = req.params.id;

    // A. Supprimer les résultats (valeurs numériques/texte)
    await client.query(`
      DELETE FROM resultat_valeur WHERE id_resultat IN (
        SELECT re.id_resultat FROM resultat_examen re
        JOIN demande_examen_ligne del ON re.id_ligne = del.id_ligne
        JOIN demande_examen de ON del.id_demande = de.id_demande
        WHERE de.id_patient = $1
      )`, [patientId]);

    // B. Supprimer les entrées de résultats d'examen
    await client.query(`
      DELETE FROM resultat_examen WHERE id_ligne IN (
        SELECT id_ligne FROM demande_examen_ligne del
        JOIN demande_examen de ON del.id_demande = de.id_demande
        WHERE de.id_patient = $1
      )`, [patientId]);

    // C. Supprimer les lignes de demande
    await client.query(`
      DELETE FROM demande_examen_ligne WHERE id_demande IN (
        SELECT id_demande FROM demande_examen WHERE id_patient = $1
      )`, [patientId]);

    // D. Supprimer les paiements/factures liés au patient (SOUVENT OUBLIÉ)
    await client.query(`DELETE FROM paiement WHERE id_patient = $1`, [patientId]);

    // E. Supprimer la demande elle-même
    await client.query(`DELETE FROM demande_examen WHERE id_patient = $1`, [patientId]);

    // F. Enfin, supprimer le patient
    const result = await client.query(`DELETE FROM patient WHERE id_patient = $1`, [patientId]);

    await client.query('COMMIT');
    res.json({ success: true, message: "Patient et toutes ses données supprimés" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: "Erreur de suppression: " + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

