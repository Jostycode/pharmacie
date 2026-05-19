const router = require("express").Router();
const pool = require("../db");

// 1. LIRE LES DEMANDES ACTIVES
router.get("/", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, p.nom, p.prenom 
      FROM demande_examen d
      JOIN patient p ON d.id_patient = p.id_patient
      WHERE d.statut IN ('en_attente') 
        AND (p.est_actif = true) 
      ORDER BY d.date_demande DESC;
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 2. VALIDER ET ARCHIVER (CORRIGÉ)
router.put("/valider/:id", async (req, res) => {
  const { interpretation } = req.body;
  const id_demande = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Mise à jour statut
    const updateRes = await client.query(
      "UPDATE demande_examen SET interpretation = $1, statut = 'validé' WHERE id_demande = $2 RETURNING id_patient",
      [interpretation, id_demande]
    );

    if (updateRes.rows.length === 0) throw new Error("Demande introuvable");
    const id_patient = updateRes.rows[0].id_patient;

    // 2. Recalcul de sécurité du montant total
    const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
    const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

    if (isLabo) {
      await client.query(
        `UPDATE demande_examen 
         SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)
         WHERE id_demande = $1`,
        [id_demande]
      );
    } else {
      await client.query("UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1", [id_demande]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: "Demande validée" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. ENREGISTRER - Version A (CORRIGÉ)
router.post("/post", async (req, res) => {
  const { id_patient, medecin, examens, interpretation } = req.body; 
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resD = await client.query(
      `INSERT INTO demande_examen (id_patient, medecin, interpretation, statut, montant_total) 
       VALUES ($1, $2, $3, 'en_attente', 0) RETURNING id_demande`,
      [id_patient, medecin, interpretation || "Non renseigné"]
    );
    const id_demande = resD.rows[0].id_demande;

    if (examens && examens.length > 0) {
      for (const id_ex of examens) {
        await client.query(
          `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
           SELECT $1, id_examen, prix FROM examen WHERE id_examen = $2`,
          [id_demande, id_ex]
        );
      }

      const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
      const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

      const montantTotal = isLabo ? `(SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)` : `0`;
      await client.query(`UPDATE demande_examen SET montant_total = ${montantTotal} WHERE id_demande = $1`, [id_demande]);
    } 

    await client.query('COMMIT');
    res.json({ success: true, id_demande });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3 BIS. ENREGISTRER - Version B (CORRIGÉ)
router.post("/post1", async (req, res) => {
  const { id_patient, medecin, examens } = req.body;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const newDemande = await client.query(
      "INSERT INTO demande_examen (id_patient, medecin, statut, montant_total) VALUES ($1, $2, 'validé', 0) RETURNING id_demande",
      [id_patient, medecin]
    );
    const id_demande = newDemande.rows[0].id_demande;

    for (const id_examen of examens) {
      await client.query(
        `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
         SELECT $1, $2, prix FROM examen WHERE id_examen = $2`,
        [id_demande, id_examen]
      );
    }

    const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
    const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

    if (isLabo) {
      await client.query(
        `UPDATE demande_examen SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1) WHERE id_demande = $1`,
        [id_demande]
      );
    } else {
      await client.query("UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1", [id_demande]);
    }

    await client.query("COMMIT");
    res.json({ success: true, id_demande });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 4. SUPPRIMER (CORRIGÉ)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM resultat_valeur WHERE id_resultat IN (SELECT re.id_resultat FROM resultat_examen re JOIN demande_examen_ligne del ON re.id_ligne = del.id_ligne WHERE del.id_demande = $1)`, [id]);
    await client.query(`DELETE FROM resultat_examen WHERE id_ligne IN (SELECT id_ligne FROM demande_examen_ligne WHERE id_demande = $1)`, [id]);
    await client.query("DELETE FROM demande_examen_ligne WHERE id_demande = $1", [id]);
    await client.query("DELETE FROM demande_examen WHERE id_demande = $1", [id]);
    await client.query('COMMIT');
    res.json({ message: "Suppression réussie" });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// 5. UPDATE (CORRIGÉ : Utilise 'client' de bout en bout)
router.put("/update/:id", async (req, res) => {
  const { id } = req.params; 
  const { medecin, examens, id_patient } = req.body; // id_patient est nécessaire pour le check consultation
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query("UPDATE demande_examen SET medecin = $1 WHERE id_demande = $2", [medecin, id]);
    await client.query("DELETE FROM demande_examen_ligne WHERE id_demande = $1", [id]);

    for (const id_examen of examens) {
      await client.query(
        `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
         SELECT $1, $2, prix FROM examen WHERE id_examen = $2`,
        [id, id_examen]
      );
    }

    // Récupération du id_patient si non fourni dans le body
    let pid = id_patient;
    if(!pid) {
        const getP = await client.query("SELECT id_patient FROM demande_examen WHERE id_demande = $1", [id]);
        pid = getP.rows[0].id_patient;
    }

    const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [pid]);
    const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

    if (isLabo) {
      await client.query(
        `UPDATE demande_examen 
         SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)
         WHERE id_demande = $1`,
        [id]
      );
    } else {
      await client.query("UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1", [id]);
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 6. LIGNES
router.get("/lignes/:id_demande", async (req, res) => {
    try {
      const r = await pool.query(`
        SELECT l.*, e.nom_examen, e.categorie
        FROM demande_examen_ligne l
        JOIN examen e ON l.id_examen = e.id_examen
        WHERE l.id_demande = $1`, [req.params.id_demande]);
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. LIRE LES DEMANDES VALIDÉES
router.get("/affiches", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, p.nom, p.prenom 
      FROM demande_examen d
      JOIN patient p ON d.id_patient = p.id_patient
      WHERE d.statut = 'validé'
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;