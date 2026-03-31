const router = require("express").Router();
const pool = require("../db");

router.get("/accueil", auth, async (req,res)=>{
  const r = await pool.query(`
    SELECT d.*, p.nom, p.prenom
    FROM demande_examen d
    JOIN patient p ON p.id_patient=d.id_patient
    WHERE d.statut='nouveau'
    ORDER BY d.date_demande DESC
  `);
  res.json(r.rows);
});

router.put("/envoyer/:id", auth, async (req,res)=>{
  await pool.query(`
    UPDATE demande_examen
    SET statut='envoye_labo'
    WHERE id_demande=$1
  `,[req.params.id]);

  res.json({message:"envoyé"});
});

module.exports = router;
