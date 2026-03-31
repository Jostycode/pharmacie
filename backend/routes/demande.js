const router = require("express").Router();
const pool = require("../db");
const auth = require("../auth")

/// CREATE DEMANDE + LIGNES
router.post("/", auth, async (req, res) => {
  const { id_patient, examens } = req.body;
  const id_medecin = req.user.id;

  const demande = await pool.query(`
    INSERT INTO demande_examen(id_patient, id_medecin)
    VALUES($1,$2)
    RETURNING *
  `, [id_patient, id_medecin]);

  const id_demande = demande.rows[0].id_demande;

  for (let id_examen of examens) {
    await pool.query(`
      INSERT INTO demande_examen_ligne(id_demande,id_examen)
      VALUES($1,$2)
    `, [id_demande, id_examen]);
  }
  io.emit("demande_updated");
  res.json({ message: "demande créée" });
});
/// READ ALL
router.get("/", async (req, res) => {
  const r = await pool.query(`
  SELECT d.id_demande,p.nom,p.prenom,d.date_demande
  FROM demande_examen d
  JOIN patient p ON p.id_patient=d.id_patient
  ORDER BY d.date_demande DESC
  `);
  res.json(r.rows);
});

/// READ ONE
router.get("/:id", async (req, res) => {
  const r = await pool.query(`
  SELECT l.id_ligne,e.nom_examen
  FROM demande_examen_ligne l
  JOIN examen e ON e.id_examen=l.id_examen
  WHERE l.id_demande=$1
  `, [req.params.id]);

  res.json(r.rows);
});

/// UPDATE STATUT
router.put("/:id", async (req, res) => {
  const { statut } = req.body;

  const r = await pool.query(`
    UPDATE demande_examen SET statut=$1
    WHERE id_demande=$2 RETURNING *
  `, [statut, req.params.id]);

  res.json(r.rows[0]);
});

/// DELETE
router.delete("/:id", async (req, res) => {
  await pool.query(`DELETE FROM demande_examen WHERE id_demande=$1`, [req.params.id]);
  res.json({ message: "supprimé" });
});

module.exports = router;
