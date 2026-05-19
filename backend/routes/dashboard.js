const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/stats", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateDeb = startDate ? `${startDate} 00:00:00` : '1970-01-01 00:00:00';
    const dateFin = endDate ? `${endDate} 23:59:59` : '2099-12-31 23:59:59';
    const params = [dateDeb, dateFin];

    // 1. KPI Globaux
    const [totalPatientsRes, totalServicesRes, totalExamensRes] = await Promise.all([
      pool.query("SELECT COUNT(*) AS total FROM patient WHERE date_creation BETWEEN $1 AND $2", params),
      pool.query("SELECT COUNT(*) AS total FROM consultation WHERE est_actif = true"),
      pool.query("SELECT COUNT(*) AS total FROM demande_examen WHERE date_demande BETWEEN $1 AND $2", params)
    ]);

    // 2. MODAL FILE D'ATTENTE PATIENTS (Avec décompte/index commençant à 1)
    const fileAttenteDetails = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER(ORDER BY date_creation DESC)::int AS index,
        id_patient, nom, prenom, sexe, consultation, statut_paye, date_creation
      FROM patient 
      WHERE date_creation BETWEEN $1 AND $2
    `, params).catch(() => ({ rows: [] }));

    // 3. MODAL UNITÉS DE SOINS (Avec classement/décompte commençant à 1 basé sur l'activité)
    const unitesActivesDetails = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER(ORDER BY (SELECT COUNT(*) FROM patient p WHERE p.consultation = c.nom_consul AND p.date_creation BETWEEN $1 AND $2) DESC, c.nom_consul ASC)::int AS index,
        c.id,
        c.nom_consul,
        c.prix,
        c.est_actif,
        COALESCE(
          (SELECT d.medecin FROM demande_examen d
           INNER JOIN patient pat ON d.id_patient = pat.id_patient
           WHERE pat.consultation = c.nom_consul AND d.date_demande BETWEEN $1 AND $2
           LIMIT 1), 
          'Aucune demande'
        ) AS medecin,
        (SELECT COUNT(*)::int FROM patient p 
         WHERE p.consultation = c.nom_consul 
         AND p.date_creation BETWEEN $1 AND $2) AS consultations_effectuees,
        (SELECT COUNT(d.id_demande)::int FROM demande_examen d
         INNER JOIN patient pat ON d.id_patient = pat.id_patient
         WHERE pat.consultation = c.nom_consul 
         AND d.date_demande BETWEEN $1 AND $2) AS prescriptions_laboratoire
      FROM consultation c
      WHERE c.est_actif = true
    `, params).catch((err) => {
      console.error("Erreur Traçabilité Unités:", err);
      return { rows: [] };
    });

    // 4. GRAPHIQUE 1 : Répartition des inscriptions
    const servicesStats = await pool.query(`
      SELECT consultation AS nom_consul, COUNT(*)::int AS nombre_patients
      FROM patient WHERE date_creation BETWEEN $1 AND $2 AND consultation IS NOT NULL
      GROUP BY consultation ORDER BY nombre_patients DESC
    `, params).catch(() => ({ rows: [] }));

    // 5. ONGLETS & LISTE DÉTAILLÉE DES ANALYSES LABO (Actives et Terminées)
    const examensStatutsFins = await pool.query(`
      SELECT 
        COUNT(CASE WHEN statut IN ('nouveau', 'en_attente') THEN 1 END)::int AS actifs,
        COUNT(CASE WHEN statut NOT IN ('nouveau', 'en_attente') THEN 1 END)::int AS non_actifs
      FROM demande_examen WHERE date_demande BETWEEN $1 AND $2
    `, params).catch(() => ({ rows: [{ actifs: 0, non_actifs: 0 }] }));

    // Requête détaillée pour alimenter les deux nouvelles modals
    const examensDetails = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER(PARTITION BY (statut IN ('nouveau', 'en_attente')) ORDER BY d.date_demande DESC)::int AS index,
        d.id_demande,
        d.date_demande,
        d.statut,
        d.medecin,
        p.nom,
        p.prenom,
        p.sexe,
        COALESCE(p.consultation, 'Non spécifié') AS service_origine
      FROM demande_examen d
      LEFT JOIN patient p ON d.id_patient = p.id_patient
      WHERE d.date_demande BETWEEN $1 AND $2
    `, params).catch(() => ({ rows: [] }));

    // Filtrage des lignes pour scinder les examens selon leur état clinique
    const examensActifsList = examensDetails.rows.filter(e => ['nouveau', 'en_attente'].includes(e.statut));
    const examensInactifsList = examensDetails.rows.filter(e => !['nouveau', 'en_attente'].includes(e.statut));

    // 6. GRAPHIQUE 2 : Nombre de demandes d'examens selon les services (Version sécurisée)
    const demandesParService = await pool.query(`
    SELECT 
        CASE 
        WHEN p.consultation IS NULL OR p.consultation = '' THEN 'Direct Labo / Non spécifié'
        ELSE p.consultation 
        END AS service_origine, 
        COUNT(d.id_demande)::int AS total_demandes
    FROM demande_examen d
    LEFT JOIN patient p ON d.id_patient = p.id_patient
    WHERE d.date_demande BETWEEN $1 AND $2
    GROUP BY p.consultation
    ORDER BY total_demandes DESC
    `, params).catch((err) => {
    console.error("Erreur Graphique 2:", err);
    return { rows: [] };
    });

    res.json({
      kpis: {
        totalPatients: parseInt(totalPatientsRes.rows[0].total || 0),
        totalServices: parseInt(totalServicesRes.rows[0].total || 0),
        totalExamens: parseInt(totalExamensRes.rows[0].total || 0),
        examensActifs: examensStatutsFins.rows[0].actifs || 0,
        examensInactifs: examensStatutsFins.rows[0].non_actifs || 0
      },
      fileAttente: fileAttenteDetails.rows,
      unitesSoins: unitesActivesDetails.rows,
      examensActifsList,      // <-- Nouvelle liste pour la modal active
      examensInactifsList,    // <-- Nouvelle liste pour la modal terminée
      services: servicesStats.rows,
      demandesExamensServices: demandesParService.rows
    });

  } catch (error) {
    console.error("Erreur critique Dashboard:", error);
    res.status(500).json({ error: "Erreur serveur lors du calcul des statistiques." });
  }
});

module.exports = router;