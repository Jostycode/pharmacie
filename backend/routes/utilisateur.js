const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// 1. GET : Récupérer uniquement les utilisateurs de la structure active
router.get("/", async (req, res) => {
  const idStructure = req.headers["x-structure-id"];
  if (!idStructure) return res.status(400).json({ error: "Structure non identifiée." });

  try {
    const result = await pool.query(
      `SELECT id_utilisateur, nom_utilisateur, role, date_creation, id_structure 
       FROM utilisateurs 
       WHERE id_structure = $1 
       ORDER BY date_creation DESC`,
      [idStructure]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur GET Utilisateurs :", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. POST : Créer un utilisateur lié à la structure actuelle
router.post("/post", async (req, res) => {
  let { nom, mdp, role } = req.body; // 'nom' reçu du front map vers 'nom_utilisateur'
  const idStructure = req.headers["x-structure-id"]; 

  if (!idStructure) return res.status(400).json({ error: "Structure non identifiée." });
  if (!nom || !mdp) return res.status(400).json({ error: "Nom de l'utilisateur et mot de passe requis." });

  if (!role || role.trim() === "") {
    role = "Pharmacien";
  }

  try {
    // Hachage sécurisé du mot de passe
    const salt = await bcrypt.genSalt(10);
    const mdpHache = await bcrypt.hash(mdp, salt);

    const result = await pool.query(
      `INSERT INTO utilisateurs (nom_utilisateur, mot_de_passe, role, id_structure) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id_utilisateur, nom_utilisateur, role, date_creation`,
      [nom, mdpHache, role, idStructure]
    );

    notifyRefresh(req);
    res.status(201).json({ 
      success: true, 
      message: "Utilisateur créé avec succès dans cette structure",
      user: result.rows[0]
    });
  } catch (err) {
    console.error("Erreur POST Utilisateur :", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. PUT : Modifier un utilisateur au sein de sa structure
router.put("/:id", async (req, res) => {
  let { nom, role, mdp } = req.body;
  const { id } = req.params; // correspond à id_utilisateur (UUID)
  const idStructure = req.headers["x-structure-id"];

  if (!idStructure) return res.status(400).json({ error: "Structure non identifiée." });
  if (!nom) return res.status(400).json({ error: "Nom de l'utilisateur requis." });

  try {
    let result;
    
    if (mdp && mdp.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      const mdpHache = await bcrypt.hash(mdp, salt);

      result = await pool.query(
        `UPDATE utilisateurs 
         SET nom_utilisateur = $1, mot_de_passe = $2, role = $3 
         WHERE id_utilisateur = $4 AND id_structure = $5
         RETURNING id_utilisateur, nom_utilisateur, role`,
        [nom, mdpHache, role, id, idStructure]
      );
    } else {
      result = await pool.query(
        `UPDATE utilisateurs 
         SET nom_utilisateur = $1, role = $2 
         WHERE id_utilisateur = $3 AND id_structure = $4
         RETURNING id_utilisateur, nom_utilisateur, role`,
        [nom, role, id, idStructure]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable ou n'appartient pas à cette structure." });
    }

    notifyRefresh(req);
    res.json({ success: true, message: "Utilisateur modifié avec succès", user: result.rows[0] });
  } catch (err) {
    console.error("Erreur PUT Utilisateur :", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE : Supprimer un utilisateur de la structure active
router.delete("/:id", async (req, res) => {
  const { id } = req.params; // id_utilisateur
  const idStructure = req.headers["x-structure-id"];

  if (!idStructure) return res.status(400).json({ error: "Structure non identifiée." });

  try {
    const result = await pool.query(
      `DELETE FROM utilisateurs 
       WHERE id_utilisateur = $1 AND id_structure = $2`, 
      [id, idStructure]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable ou n'appartient pas à cette structure." });
    }

    notifyRefresh(req);
    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (err) {
    console.error("Erreur DELETE Utilisateur :", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. CONNEXION : Authentification ciblée par structure
router.post("/connexion", async (req, res) => {
  const { nom, mdp, id_structure } = req.body; 

  if (!id_structure) return res.status(400).json({ success: false, message: "Structure manquante." });
  if (!nom || !mdp) return res.status(400).json({ success: false, message: "Identifiants incomplets." });

  try {
    const result = await pool.query(
      `SELECT id_utilisateur, nom_utilisateur, mot_de_passe, role, id_structure 
       FROM utilisateurs 
       WHERE LOWER(nom_utilisateur) = LOWER($1) AND id_structure = $2`, 
      [nom, id_structure]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects pour cette clinique." });
    }

    const user = result.rows[0];
    const mdpValide = await bcrypt.compare(mdp, user.mot_de_passe);

    if (mdpValide) {
      // Sécurité : On vire le hash avant l'envoi au client
      delete user.mot_de_passe;
      res.json({ success: true, message: "Connexion réussie", user });
    } else {
      res.status(401).json({ success: false, message: "Identifiants incorrects pour cette clinique." });
    }
  } catch (error) {
    console.error("Erreur CONNEXION Utilisateur :", error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

module.exports = router;