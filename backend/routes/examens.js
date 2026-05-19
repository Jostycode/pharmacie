const router = require("express").Router();
const pool = require("../db");

// --- CRÉATION ---
router.post("/post", async (req, res) => {
  const { nom_examen, categorie, parametre, valeurs_defaut, sous_categories, examens_inclus, prix, resultat } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const newExamen = await client.query(
      `INSERT INTO examen(nom_examen, categorie, parametre, valeurs_defaut, sous_categories, prix, resultat) 
       VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nom_examen, categorie, parametre, valeurs_defaut, sous_categories, prix || 0, resultat]
    );

    const id_nouveau = newExamen.rows[0].id_examen;

    // Si c'est un bilan, on gère l'affiliation des examens
    if (categorie === 'BILAN' && Array.isArray(examens_inclus) && examens_inclus.length > 0) {
      for (let item of examens_inclus) {
        // item doit être { id_examen: X, sous_cat: 'Y' }
        await client.query(
          `INSERT INTO bilan_composition (id_bilan, id_examen_affilie, sous_categorie_specifique) 
           VALUES ($1, $2, $3)`,
          [id_nouveau, item.id_examen, item.sous_cat]
        );
      }
    }

    await client.query('COMMIT');
    res.json(newExamen.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur POST examen:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- MISE À JOUR ---
router.put("/:id", async (req, res) => {
  const { nom_examen, categorie, parametre, valeurs_defaut, sous_categories, examens_inclus, prix, resultat } = req.body;
  const id_examen = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const r = await client.query(
      `UPDATE examen SET nom_examen=$1, categorie=$2, valeurs_defaut=$3, parametre=$4, sous_categories=$5, prix=$6, resultat=$7 
       WHERE id_examen=$8 RETURNING *`,
      [nom_examen, categorie, valeurs_defaut, parametre, sous_categories, prix || 0, resultat, id_examen]
    );

    if (categorie === 'BILAN') {
      // On vide l'ancienne composition pour ré-insérer la nouvelle
      await client.query(`DELETE FROM bilan_composition WHERE id_bilan = $1`, [id_examen]);
      
      if (Array.isArray(examens_inclus) && examens_inclus.length > 0) {
        for (let item of examens_inclus) {
          await client.query(
            `INSERT INTO bilan_composition (id_bilan, id_examen_affilie, sous_categorie_specifique) 
             VALUES ($1, $2, $3)`,
            [id_examen, item.id_examen, item.sous_cat]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Erreur PUT examen:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- LECTURE ---
router.get("/", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM examen ORDER BY est_actif DESC, categorie ASC, nom_examen ASC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Récupérer la composition d'un bilan spécifique
router.get("/composition/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT id_examen_affilie as id_examen, sous_categorie_specifique as sous_cat 
       FROM bilan_composition 
       WHERE id_bilan = $1`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ARCHIVAGE ---
router.patch("/archive/:id", async (req, res) => {
  try {
    await pool.query("UPDATE examen SET est_actif = $1 WHERE id_examen = $2", [req.body.statut, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;