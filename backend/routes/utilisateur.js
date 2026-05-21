const router = require("express").Router();
const pool = require("../db");

router.post("/post", async (req, res) => {
  const { nom, mdp, role } = req.body;

  try {
    await pool.query(
      `INSERT INTO inscription (nom, mdp, role) VALUES ($1, $2, $3)`,
      [nom, mdp, role]
    );
    res.json({ message: "Utilisateur créé" });
  } catch (err) {
    console.error("Détail de l'erreur SQL :", err); // <-- AJOUTE CECI POUR LIRE LE MESSAGE DANS TON TERMINAL NODE
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id_user, nom, mdp, role, actif FROM inscription`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  const { nom, role, mdp } = req.body;
  const { id } = req.params;

  try {
    if (mdp && mdp.trim() !== "") {
      await pool.query(
        `UPDATE inscription 
         SET nom=$1, mdp=$2, role=$3  
         WHERE id_user=$4`,
        [nom, mdp, role, id] // <-- L'ordre est maintenant corrigé !
      );
    } else {
      await pool.query(
        `UPDATE inscription 
         SET nom=$1, role=$2 
         WHERE id_user=$3`,
        [nom, role, id]
      );
    }

    res.json({ message: "Utilisateur modifié" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM inscription WHERE id_user=$1`,
      [req.params.id]
    );
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/connexion", async (req, res) => {
  // On récupère "nom" car c'est ce que ton frontend envoie
  const { nom, mdp } = req.body; 

  try {
    const result = await pool.query(
      "SELECT * FROM inscription WHERE LOWER(nom) = LOWER($1) AND mdp = $2", 
      [nom, mdp]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, user: result.rows[0] });
    } else {
      res.json({ success: false, message: "Identifiants invalides" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});


// router.post("/connexion", async (req, res) => {
//   const { nom, mdp } = req.body;

//   if (!nom || !mdp) {
//     return res.status(400).json({
//       success: false,
//       message: "Nom et mot de passe requis"
//     });
//   }

//   try {
//     const result = await pool.query(
//       `SELECT id_user, nom, role
//        FROM inscription
//        WHERE nom = $1
//          AND mdp = $2
//          AND actif = true`,
//       [nom, mdp]
//     );

//     if (result.rows.length === 0) {
//       return res.json({
//         success: false,
//         message: "Identifiants incorrects"
//       });
//     }

//     res.json({
//       success: true,
//       user: result.rows[0]
//     });

//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Erreur serveur",
//       error: error.message
//     });
//   }
// });

module.exports = router;