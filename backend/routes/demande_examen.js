const router = require("express").Router();
const pool = require("../db");

// CREATE : Enregistrer une demande avec ses examens
router.post("/post", async (req, res) => {
  const { id_patient, id_medecin, examens } = req.body; // examens est un tableau d'IDs
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Créer la demande
    const demandeRes = await client.query(
      `INSERT INTO demande_examen(id_patient, id_medecin) VALUES($1, $2) RETURNING id_demande`,
      [id_patient, id_medecin]
    );
    const id_demande = demandeRes.rows[0].id_demande;

    // 2. Créer les lignes d'examens
    for (let id_examen of examens) {
      await client.query(
        `INSERT INTO demande_examen_ligne(id_demande, id_examen) VALUES($1, $2)`,
        [id_demande, id_examen]
      );
    }

    await client.query('COMMIT');
    res.json({ message: "Demande enregistrée avec succès", id_demande });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// READ ALL (avec jointure pour voir le nom du patient)
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, p.nom, p.prenom 
      FROM demande_examen d
      JOIN patient p ON d.id_patient = p.id_patient
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;