const router = require("express").Router();
const pool = require("../db");

// 1. Récupérer les examens en attente (inchangé car basé sur la table pivot)
router.get("/en_attente", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        l.id_ligne, l.id_demande, d.date_demande, p.nom, p.prenom,
        -- Si c'est un bilan, on récupère les infos de l'examen affilié, sinon de l'examen direct
        COALESCE(e_affilie.nom_examen, e.nom_examen) AS nom_examen,
        COALESCE(e_affilie.categorie, e.categorie) AS categorie,
        COALESCE(e_affilie.sous_categories, e.sous_categories) AS sous_categories,
        COALESCE(e_affilie.type_resultat, e.type_resultat) AS type_resultat,
        COALESCE(e_affilie.parametre, e.parametre) AS parametre,
        e.nom_examen as nom_bilan_origine -- Utile pour savoir si ça vient d'un pack
      FROM demande_examen_ligne l
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      -- Jointure optionnelle vers la composition du bilan
      LEFT JOIN bilan_composition bc ON e.id_examen = bc.id_bilan
      LEFT JOIN examen e_affilie ON bc.id_examen_affilie = e_affilie.id_examen
      LEFT JOIN resultat_examen re ON l.id_ligne = re.id_ligne
      WHERE re.id_resultat IS NULL and d.statut IN ('validé')
      ORDER BY d.date_demande DESC
    `);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- 2. Enregistrer un résultat (Moteur d'Aiguillage mis à jour) ---
// --- Enregistrer un résultat ---
// --- Enregistrer un résultat (Moteur d'Aiguillage mis à jour) ---
router.post("/", async (req, res) => {
  const { 
    id_ligne, id_examen_reel, valide_par, parametres, categorie, 
    bacterioData, seroData, hematoData, paraData, spermoData 
  } = req.body;
  
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    // 1. Insertion dans la table principale
    const resResultat = await client.query(
      `INSERT INTO resultat_examen (id_ligne, id_examen, valide_par, statut) 
       VALUES ($1, $2, $3, 'termine') RETURNING id_resultat`,
      [id_ligne, id_examen_reel, valide_par]
    );
    
    const id_resultat = resResultat.rows[0].id_resultat;
    const cat = (categorie || "").toLowerCase();

    // 2. Insertion des paramètres individuels (LMS, LMD, MDC, etc.)
    // Indispensable pour que vos virgules splitées soient enregistrées
    if (Array.isArray(parametres)) {
      for (let p of parametres) {
        if (p.nom) { // On évite d'insérer des lignes vides
          await client.query(
            `INSERT INTO resultat_valeur (id_resultat, nom_parametre, valeur, unite, valeur_normale, interpretation) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [id_resultat, p.nom, p.valeur, p.unite, p.normale, p.interpretation]
          );
        }
      }
    }

    // 3. Insertion spécifique BACTÉRIOLOGIE
    if (cat.includes("bactério")) {
      await client.query(
        `INSERT INTO resultat_bacteriologie (
          id_resultat, nature_prelevement, examen_macroscopique, 
          examen_direct_gram, culture_identification
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          id_resultat, 
          bacterioData?.nature || null, 
          bacterioData?.macroscopique || null, 
          bacterioData?.direct || null, 
          bacterioData?.culture || null
        ]
      );
    }

    // ... Ajoutez les blocs pour Parasito / Séro selon le même modèle ...

    await client.query('COMMIT');
    res.json({ success: true, id_resultat });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("ERREUR SERVEUR:", err.message); // Vérifiez votre terminal Node ici !
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Route de récupération des détails adaptée (Cherche dans toutes les tables)
router.get("/details/:id_resultat", async (req, res) => {
  try {
    const { id_resultat } = req.params;
    // Cette requête doit être capable de lire dans n'importe quelle table de résultat
    // Le plus simple est de faire une vue ou une requête qui cherche dans 'resultat_valeur' 
    // ou les tables spécifiques selon le type.
    const r = await pool.query(`
      SELECT * FROM resultat_valeur WHERE id_resultat = $1
      UNION ALL
      SELECT id_resultat, NULL, 'Germe', culture_identification, 'Prélèvement', nature_prelevement, NULL 
      FROM resultat_bacteriologie WHERE id_resultat = $1
      -- Ajoutez les autres tables si nécessaire
    `, [id_resultat]);
    
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 3. Récupérer les examens déjà effectués (Archives)
router.get("/effectues", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
      re.id_resultat, re.id_ligne, re.date_resultat AS date_validation, re.valide_par,
      p.nom AS nom_patient, p.prenom AS prenom_patient,
      e.nom_examen, e.categorie, e.sous_categories -- AJOUT ICI
      FROM resultat_examen re
      JOIN demande_examen_ligne l ON re.id_ligne = l.id_ligne
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient
      JOIN examen e ON l.id_examen = e.id_examen
      ORDER BY re.date_resultat DESC
    `);
    
    console.log("Nombre de résultats trouvés:", r.rows.length); // Pour déboguer dans votre console
    res.json(r.rows);
  } catch (err) {
    console.error("Erreur SQL Archives:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/complets", async (req, res) => {
  try {
    const query = `
      -- 1. RESULTATS CLASSIQUES (BIOCHIMIE, HEMATO, ETC.)
      SELECT p.id_patient, p.nom, p.prenom, d.id_demande, d.date_demande, 
             e.nom_examen, e.categorie, e.sous_categories, 
             rv.nom_parametre, rv.valeur, rv.unite, rv.valeur_normale,
             CASE WHEN e.type_resultat = 'bilan' THEN 'OUI' ELSE 'NON' END as est_bilan
      FROM resultat_valeur rv
      JOIN resultat_examen re ON rv.id_resultat = re.id_resultat
      JOIN demande_examen_ligne l ON re.id_ligne = l.id_ligne
      JOIN examen e ON l.id_examen = e.id_examen
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient

      UNION ALL

      -- 2. SÉROLOGIE
      SELECT p.id_patient, p.nom, p.prenom, d.id_demande, d.date_demande, 
             e.nom_examen, e.categorie, e.sous_categories,
             'Conclusion' as nom_parametre, rs.interpretation_globale as valeur, 
             '' as unite, 'Index: ' || rs.index_valeur as valeur_normale,
             'NON' as est_bilan -- AJOUTÉ POUR CORRESPONDRE AU NOMBRE DE COLONNES
      FROM resultat_serologie rs
      JOIN resultat_examen re ON rs.id_resultat = re.id_resultat
      JOIN demande_examen_ligne l ON re.id_ligne = l.id_ligne
      JOIN examen e ON l.id_examen = e.id_examen
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient

      UNION ALL

      -- 3. BACTÉRIOLOGIE
      SELECT p.id_patient, p.nom, p.prenom, d.id_demande, d.date_demande, 
             e.nom_examen, e.categorie, e.sous_categories,
             'Germe' as nom_parametre, rb.culture_identification as valeur, 
             'Prélèvement' as unite, rb.nature_prelevement as valeur_normale,
             'NON' as est_bilan -- AJOUTÉ POUR CORRESPONDRE AU NOMBRE DE COLONNES
      FROM resultat_bacteriologie rb
      JOIN resultat_examen re ON rb.id_resultat = re.id_resultat
      JOIN demande_examen_ligne l ON re.id_ligne = l.id_ligne
      JOIN examen e ON l.id_examen = e.id_examen
      JOIN demande_examen d ON l.id_demande = d.id_demande
      JOIN patient p ON d.id_patient = p.id_patient

      ORDER BY date_demande DESC, categorie ASC, nom_examen ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur route complets:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;