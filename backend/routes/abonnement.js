const router = require("express").Router();
const pool = require("../db");

// GET : On ajoute impérativement id_abonnement pour que React puisse l'utiliser
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_abonnement, nom, telephone, adresse, date_creation FROM abonnement ORDER BY date_creation DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/post", async (req, res) => {
  const { nom, telephone, adresse } = req.body;
  try {
    await pool.query(
      `INSERT INTO abonnement (nom, telephone, adresse) VALUES ($1, $2, $3)`,
      [nom, telephone, adresse]
    );
    // Optionnel : io.emit("abonnement_updated"); si io est accessible ici
    res.json({ message: "Abonné créé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT : Correction de l'URL (on enlève /api/abonnement car c'est le préfixe du router)
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, telephone, adresse } = req.body;

  try {
    const result = await pool.query(
      "UPDATE abonnement SET nom = $1, telephone = $2, adresse = $3 WHERE id_abonnement = $4", 
      [nom, telephone, adresse, id]
    );
    
    // Vérifie si io est défini globalement ou passé par middleware
    if (typeof io !== 'undefined') io.emit("abonnement_updated");
    
    res.json({ message: "Mis à jour avec succès" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query(`DELETE FROM abonnement WHERE id_abonnement=$1`, [req.params.id]);
    res.json({ message: "Abonnement supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;