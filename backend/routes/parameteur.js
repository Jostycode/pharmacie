const router = require("express").Router();
const pool = require("../db");

// CREATE 
router.post("/post", async (req, res) => {
  // Extraction de la taille depuis le corps de la requête
  const { age, poids, taille, tension, temperature } = req.body;
  try {
    const r = await pool.query(`
      INSERT INTO patient(age, poids, taille, tension, temperature)
      VALUES($1, $2, $3, $4, $5)
      RETURNING *
    `, [age || 0, poids || 0, taille || null, tension || null, temperature || null]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL
router.get("/", async (req, res) => {
  const r = await pool.query(`SELECT * FROM patient ORDER BY date_creation DESC`);
  res.json(r.rows);
});

// UPDATE
router.put("/:id", async (req, res) => {
  // Prise en compte de la taille pour la mise à jour
  const { age, poids, taille, tension, temperature } = req.body;
  try {
    const r = await pool.query(`
      UPDATE patient
      SET age=$1,
          poids=$2,
          taille=$3,
          tension=$4,
          temperature=$5
      WHERE id_patient=$6
      RETURNING *
    `, [age, poids, taille, tension, temperature, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;