const router = require("express").Router();
const pool = require("../db");

// affiche liste des examens
router.get("/", auth, async (req,res)=>{
  const r = await pool.query(`
    SELECT d.id_demande,p.nom,p.prenom
    FROM demande_examen d
    JOIN patient p ON p.id_patient=d.id_patient
    WHERE d.statut='envoye_labo'
  `);
  res.json(r.rows);
});

// Voir examens d’un patient
router.get("/:id", auth, async (req,res)=>{
  const r = await pool.query(`
    SELECT l.id_ligne,e.nom_examen,e.type_resultat
    FROM demande_examen_ligne l
    JOIN examen e ON e.id_examen=l.id_examen
    WHERE l.id_demande=$1
  `,[req.params.id]);

  res.json(r.rows);
});

// enregistrer
router.post("/resultat", auth, async (req,res)=>{
  const { id_ligne, valeurs } = req.body;

  const result = await pool.query(`
    INSERT INTO resultat_examen(id_ligne,valide_par,statut)
    VALUES($1,$2,'valide')
    RETURNING id_resultat
  `,[id_ligne, req.user.id]);

  const id_resultat = result.rows[0].id_resultat;

  for (let v of valeurs){
    await pool.query(`
      INSERT INTO resultat_valeur(
        id_resultat,nom_parametre,valeur,unite,valeur_normale,interpretation
      )
      VALUES($1,$2,$3,$4,$5,$6)
    `,[id_resultat,v.nom,v.valeur,v.unite,v.norme,v.interpretation]);
  }

  res.json({message:"résultat enregistré"});
});

// marquer demande terminer
router.put("/terminer/:id", auth, async (req,res)=>{
  await pool.query(`
    UPDATE demande_examen
    SET statut='termine'
    WHERE id_demande=$1
  `,[req.params.id]);

  res.json({message:"terminé"});
});

module.exports = router;