const router = require("express").Router();
const pool = require("../db");

// CREATE 
router.post("/post", async (req, res) => {
  const { age, poids } = req.body;
  try {
    const r = await pool.query(`
      INSERT INTO patient(age, poids)
      VALUES($1, $2)
      RETURNING *
    `, [age || 0, poids || 0]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// READ ALL
router.get("/", async (req, res) => {
  // On s'assure de récupérer id_patient pour le Frontend
  const r = await pool.query(`SELECT * FROM patient ORDER BY date_creation DESC`);
  res.json(r.rows);
});

// UPDATE
router.put("/:id", async (req, res) => {
  const { age, poids } = req.body;
  try {
    const r = await pool.query(`
      UPDATE patient
      SET age=$1,
          poids=$2  -- Correction : suppression de la virgule ici
      WHERE id_patient=$3
      RETURNING *
    `, [age, poids, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;