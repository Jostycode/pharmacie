const router = require("express").Router();
const pool = require("../db");

// CREATE 
router.post("/post", async (req, res) => {
  const { age, poids, tension, temperature } = req.body;
  try {
    const r = await pool.query(`
      INSERT INTO patient(age, poids, tension, temperature)
      VALUES($1, $2, $3, $4)
      RETURNING *
    `, [age || 0, poids || 0, tension || null, temperature || null]);
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
  const { age, poids, tension, temperature } = req.body;
  try {
    const r = await pool.query(`
      UPDATE patient
      SET age=$1,
          poids=$2,
          tension=$3,
          temperature=$4
      WHERE id_patient=$5
      RETURNING *
    `, [age, poids, tension, temperature, req.params.id]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;