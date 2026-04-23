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
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 2. VALIDER ET ARCHIVER
router.put("/valider/:id", async (req, res) => {
  const { interpretation } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Mise à jour de l'interprétation et passage en statut 'validé'
    await client.query(
      "UPDATE demande_examen SET interpretation = $1, statut = 'validé' WHERE id_demande = $2",
      [interpretation, req.params.id]
    );

    // 2. Recalcul de sécurité du montant total
    // On s'assure que le montant stocké est bien le reflet exact des lignes
    // On récupère d'abord le type de consultation du patient
    const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
    const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

    if (isLabo) {
      // Si c'est un labo, on calcule normalement la somme des examens
      await client.query(
        `UPDATE demande_examen 
        SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)
        WHERE id_demande = $1`,
        [id_demande]
      );
    } else {
      // Sinon, on force le montant_total à 0 (car les examens sont peut-être gratuits ou inclus)
      await client.query(
        "UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1",
        [id_demande]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: "Demande validée et montant actualisé" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ error: "Erreur lors de la validation" });
  } finally {
    client.release();
  }
});

// 3. ENREGISTRER (Transactionnelle)
router.post("/post", async (req, res) => {
  const { id_patient, medecin, examens, interpretation } = req.body; 
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Créer la demande (montant initialisé à 0)
    const resD = await client.query(
      `INSERT INTO demande_examen (id_patient, medecin, interpretation, statut, montant_total) 
       VALUES ($1, $2, $3, 'en_attente', 0) RETURNING id_demande`,
      [id_patient, medecin, interpretation || "Non renseigné"]
    );
    
    const id_demande = resD.rows[0].id_demande;

    // 2. Insérer chaque examen en figeant le prix actuel du catalogue
    if (examens && examens.length > 0) {
      for (const id_ex of examens) {
        await client.query(
          `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
           SELECT $1, id_examen, prix::numeric FROM examen WHERE id_examen = $2`,
          [id_demande, id_ex]
        );
      }

      // 3. Mise à jour automatique du montant TOTAL de la demande
      // On récupère d'abord le type de consultation du patient
      const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
      const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

      if (isLabo) {
        // Si c'est un labo, on calcule normalement la somme des examens
        await client.query(
          `UPDATE demande_examen 
          SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)
          WHERE id_demande = $1`,
          [id_demande]
        );
      } else {
        // Sinon, on force le montant_total à 0 (car les examens sont peut-être gratuits ou inclus)
        await client.query(
          "UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1",
          [id_demande]
        );
      }
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

// 3. ENREGISTRER (Transactionnelle)
router.post("/post1", async (req, res) => {
  const { id_patient, medecin, examens } = req.body;

  try {
    await pool.query("BEGIN");

    // 1. Créer la demande (montant initial à 0)
    const newDemande = await pool.query(
      "INSERT INTO demande_examen (id_patient, medecin, statut, montant_total) VALUES ($1, $2, 'en_attente', 0) RETURNING id_demande",
      [id_patient, medecin]
    );
    const id_demande = newDemande.rows[0].id_demande;

    // 2. Insérer les lignes et récupérer les prix depuis la table examen
    for (const id_examen of examens) {
      await pool.query(
        `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
         SELECT $1, $2, prix FROM examen WHERE id_examen = $2`,
        [id_demande, id_examen]
      );
    }

    // 3. Calculer le total et mettre à jour la table principale
    // On récupère d'abord le type de consultation du patient
    const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
    const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

    if (isLabo) {
      // Si c'est un labo, on calcule normalement la somme des examens
      await client.query(
        `UPDATE demande_examen 
        SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)
        WHERE id_demande = $1`,
        [id_demande]
      );
    } else {
      // Sinon, on force le montant_total à 0 (car les examens sont peut-être gratuits ou inclus)
      await client.query(
        "UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1",
        [id_demande]
      );
    }

    await pool.query("COMMIT");
    res.json({ success: true, id_demande });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Erreur lors de la création de la demande" });
  }
});


// 4. SUPPRIMER (Gère la contrainte de clé étrangère manuellement)
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Supprimer les valeurs des résultats liés à cette demande
    await client.query(`
      DELETE FROM resultat_valeur 
      WHERE id_resultat IN (
        SELECT re.id_resultat FROM resultat_examen re
        JOIN demande_examen_ligne del ON re.id_ligne = del.id_ligne
        WHERE del.id_demande = $1
      )`, [id]);

    // 2. Supprimer les résultats eux-mêmes
    await client.query(`
      DELETE FROM resultat_examen 
      WHERE id_ligne IN (SELECT id_ligne FROM demande_examen_ligne WHERE id_demande = $1)
    `, [id]);

    // 3. Supprimer les lignes d'examens
    await client.query("DELETE FROM demande_examen_ligne WHERE id_demande = $1", [id]);

    // 4. Supprimer la demande parente
    await client.query("DELETE FROM demande_examen WHERE id_demande = $1", [id]);

    await client.query('COMMIT');
    res.json({ message: "Demande et toutes les données associées supprimées" });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: "Erreur lors de la suppression en cascade" });
  } finally { client.release(); }
});

// 5. UPDATE
router.put("/update/:id", async (req, res) => {
  const { id } = req.params; // id_demande
  const { medecin, examens } = req.body;

  try {
    await pool.query("BEGIN");

    // 1. Mettre à jour les infos de base
    await pool.query(
      "UPDATE demande_examen SET medecin = $1 WHERE id_demande = $2",
      [medecin, id]
    );

    // 2. Supprimer les anciens examens
    await pool.query("DELETE FROM demande_examen_ligne WHERE id_demande = $1", [id]);

    // 3. Insérer les nouveaux examens avec leurs prix actuels
    for (const id_examen of examens) {
      await pool.query(
        `INSERT INTO demande_examen_ligne (id_demande, id_examen, prix_applique) 
         SELECT $1, $2, prix FROM examen WHERE id_examen = $2`,
        [id, id_examen]
      );
    }

    // 4. Recalculer le montant TOTAL de la demande
    // On récupère d'abord le type de consultation du patient
    const patientCheck = await client.query("SELECT consultation FROM patient WHERE id_patient = $1", [id_patient]);
    const isLabo = patientCheck.rows[0]?.consultation === 'laboratoire';

    if (isLabo) {
      // Si c'est un labo, on calcule normalement la somme des examens
      await client.query(
        `UPDATE demande_examen 
        SET montant_total = (SELECT COALESCE(SUM(prix_applique), 0) FROM demande_examen_ligne WHERE id_demande = $1)
        WHERE id_demande = $1`,
        [id_demande]
      );
    } else {
      // Sinon, on force le montant_total à 0 (car les examens sont peut-être gratuits ou inclus)
      await client.query(
        "UPDATE demande_examen SET montant_total = 0 WHERE id_demande = $1",
        [id_demande]
      );
    }
    

    await pool.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err.message);
    res.status(500).json({ error: "Erreur lors de la mise à jour" });
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

// 7. LIRE LES DEMANDES ACTIVES
router.get("/affiches", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.*, p.nom, p.prenom, 
        (SELECT SUM(prix_applique) FROM demande_examen_ligne WHERE id_demande = d.id_demande) as total
      FROM demande_examen d
      JOIN patient p ON d.id_patient = p.id_patient
      WHERE d.statut IN ('validé')
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

module.exports = router;