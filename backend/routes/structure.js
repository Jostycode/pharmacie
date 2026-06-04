const router = require("express").Router();
const pool = require("../db");
const bcrypt = require("bcrypt");

// --- UTILITAIRE : NOTIFICATION TEMPS RÉEL ---
const notifyRefresh = (req) => {
  const io = req.app.get("socketio") || req.io;
  if (io) io.emit("refresh_data");
};

// --- 1. CRÉER UNE NOUVELLE STRUCTURE (POST) ---
router.post("/post", async (req, res) => {
  const { nom, raison_sociale, adresse, telephone, mdp } = req.body;

  if (!nom || !raison_sociale || !mdp) {
    return res.status(400).json({ error: "Le nom, la raison sociale et le mot de passe sont requis." });
  }

  try {
    const sel = await bcrypt.genSalt(10);
    const mdpHache = await bcrypt.hash(mdp, sel);

    const result = await pool.query(
      `INSERT INTO structures (nom, raison_sociale, adresse, telephone, mdp) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id_structure, nom, raison_sociale, adresse, telephone, created_at`,
      [nom, raison_sociale, adresse, telephone, mdpHache]
    );

    notifyRefresh(req);
    res.status(201).json({
      success: true,
      message: "Structure enregistrée avec succès.",
      structure: result.rows[0]
    });
  } catch (err) {
    console.error("Erreur DB POST Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 2. LIRE TOUTES LES STRUCTURES (GET ALL) ---
router.get("/", async (req, res) => {
  try {
    // Sélection explicite de "mdp" pour l'affichage requis dans ton tableau de contrôle
    const r = await pool.query("SELECT id_structure, nom, raison_sociale, adresse, telephone, mdp, created_at FROM structures ORDER BY created_at DESC");
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur GET Structures :", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 3. MODIFIER UNE STRUCTURE (PUT) ---
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { nom, raison_sociale, adresse, telephone, mdp } = req.body;

  try {
    let result;
    if (mdp && mdp.trim() !== "") {
      // Si un nouveau mot de passe est saisi, on le hache
      const sel = await bcrypt.genSalt(10);
      const mdpHache = await bcrypt.hash(mdp, sel);
      
      result = await pool.query(
        `UPDATE structures 
         SET nom = $1, raison_sociale = $2, adresse = $3, telephone = $4, mdp = $5 
         WHERE id_structure = $6 RETURNING *`,
        [nom, raison_sociale, adresse, telephone, mdpHache, id]
      );
    } else {
      // Sinon, on met à jour les informations sans toucher au mot de passe existant
      result = await pool.query(
        `UPDATE structures 
         SET nom = $1, raison_sociale = $2, adresse = $3, telephone = $4 
         WHERE id_structure = $5 RETURNING *`,
        [nom, raison_sociale, adresse, telephone, id]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Structure non trouvée" });
    }

    notifyRefresh(req);
    res.json({ success: true, message: "Structure modifiée avec succès", structure: result.rows[0] });
  } catch (err) {
    console.error("Erreur DB PUT Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 4. SUPPRIMER UNE STRUCTURE (DELETE) ---
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM structures WHERE id_structure = $1", [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Structure introuvable" });
    }

    notifyRefresh(req);
    res.json({ success: true, message: "Structure supprimée définitivement" });
  } catch (err) {
    console.error("Erreur DB DELETE Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- 5. CONNEXION / AUTHENTIFICATION (POST) ---
router.post("/connexion", async (req, res) => {
  const { nom, mdp } = req.body;
  try {
    const result = await pool.query("SELECT * FROM structures WHERE nom = $1", [nom]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    const structure = result.rows[0];
    const mdpValide = await bcrypt.compare(mdp, structure.mdp);

    if (!mdpValide) {
      return res.status(401).json({ success: false, message: "Identifiants invalides." });
    }

    res.json({
      success: true,
      structureId: structure.id_structure,
      nom: structure.nom
    });
  } catch (err) {
    console.error("Erreur Connexion Structure:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;