import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";

function ListeResultatsGroupes() {
  const [resultats, setResultats] = useState([]);
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  // État pour savoir quel dossier est en cours d'impression (null = tous)
  const [printingId, setPrintingId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("http://localhost:3000/api/resultats/complets");
        setResultats(res.data);
      } catch (err) { console.error(err); }
    };
    fetchData();
  }, []);

  const demandesGroupees = useMemo(() => {
    const dossiers = {};
    if (!resultats || resultats.length === 0) return [];

    resultats.forEach((ligne) => {
      const cleDossier = `${ligne.id_patient}_${ligne.id_demande}`;
      if (!dossiers[cleDossier]) {
        dossiers[cleDossier] = {
          idUnique: cleDossier, // On stocke la clé pour l'identification
          infosPatient: { 
            id: ligne.id_patient, 
            nom: ligne.nom, 
            prenom: ligne.prenom, 
            date: ligne.date_demande,
            medecin: ligne.medecin // Optionnel : ajouter le médecin
          },
          categories: {} 
        };
      }

      const catNom = ligne.categorie || "Autres";
      const examenCle = ligne.est_bilan === 'OUI' ? `BILAN : ${ligne.nom_examen}` : ligne.nom_examen;

      if (!dossiers[cleDossier].categories[catNom]) dossiers[cleDossier].categories[catNom] = {};
      if (!dossiers[cleDossier].categories[catNom][examenCle]) dossiers[cleDossier].categories[catNom][examenCle] = [];
      
      dossiers[cleDossier].categories[catNom][examenCle].push(ligne);
    });

    return Object.values(dossiers).filter(d => {
        const nomComplet = `${d.infosPatient.nom || ""} ${d.infosPatient.prenom || ""}`.toLowerCase();
        const matchNom = nomComplet.includes(search.toLowerCase());
        let matchDate = true;
        if (filterDate !== "" && d.infosPatient.date) {
            const dateDossier = new Date(d.infosPatient.date).toISOString().split('T')[0];
            matchDate = dateDossier === filterDate;
        }
        return matchNom && matchDate;
    });
  }, [resultats, search, filterDate]);

  // FONCTION D'IMPRESSION
  const imprimerDossier = (idUnique) => {
    setPrintingId(idUnique); // On définit quel patient imprimer
    setTimeout(() => {
      window.print();
      setPrintingId(null); // On remet à zéro après l'impression
    }, 100);
  };

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          /* 1. Masquer tout ce qui n'est pas le dossier sélectionné */
          .no-print, .card, .bg-light { display: none !important; }
          
          /* 2. Afficher uniquement le dossier en cours d'impression */
          .print-section-${printingId} { 
            display: block !important; 
            width: 100% !important;
            position: absolute;
            top: 0;
            left: 0;
          }

          /* 3. Forcer le rendu des tableaux */
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #000 !important; padding: 6px !important; font-size: 11px !important; }
          
          /* 4. En-tête spécifique à l'impression */
          .print-header { display: flex !important; border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
          
          @page { margin: 0.5cm; }
        }

        /* Hors impression, on cache l'en-tête de document */
        .print-header { display: none; }
      `}</style>

      {/* Interface de filtrage (no-print) */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-light p-3 rounded shadow-sm no-print">
        <h4>📋 Gestion des Dossiers</h4>
        <div className="d-flex gap-2 w-50">
          <input type="date" className="form-control" onChange={(e) => setFilterDate(e.target.value)} />
          <input type="text" className="form-control" placeholder="Nom du patient..." onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {demandesGroupees.map((groupe, idx) => (
        <div 
          key={idx} 
          className={`card mb-5 border-none ${printingId === groupe.idUnique ? `print-section-${groupe.idUnique}` : ''}`}
        >
          {/* HEADER CARTE (Visible à l'écran) */}
          <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center no-print">
            <div>
              <strong className="text-uppercase">{groupe.infosPatient.nom} {groupe.infosPatient.prenom}</strong>
              <span className="ms-3 small">📅 {new Date(groupe.infosPatient.date).toLocaleDateString()}</span>
            </div>
            <button className="btn btn-sm btn-light fw-bold" onClick={() => imprimerDossier(groupe.idUnique)}>
              🖨️ IMPRIMER CE DOSSIER
            </button>
          </div>

          {/* EN-TÊTE PROFESSIONNEL (Uniquement à l'impression) */}
          <div className="print-header row align-items-center">
            <div className="col-6">
              <h4 className="fw-bold text-uppercase mb-0">destiny express</h4>
              <p className="small mb-0">Laboratoire d'Analyses Médicales</p>
              <p className="small mb-0">Tél : +242 XX XXX XX XX</p>
            </div>
            <div className="col-6 text-end">
              <h5 className="text-decoration-underline">RAPPORT D'EXAMENS</h5>
              <p className="mb-0"><strong>Patient :</strong> {groupe.infosPatient.nom} {groupe.infosPatient.prenom}</p>
              <p className="small mb-0">Date : {new Date(groupe.infosPatient.date).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="card-body p-print-0">
            {Object.entries(groupe.categories).map(([nomCat, examensDuGroupe], catIdx) => (
              <div key={catIdx} className="mb-4 border rounded">
                <h6 className="bg-dark text-white p-2 text-uppercase mb-0" style={{fontSize: '20px'}}>
                  {nomCat}
                </h6>
                <div className="p-2">
                  {Object.entries(examensDuGroupe).map(([nomExamen, lignes], exIdx) => {
                    const isBio = lignes[0]?.est_biochimie === 'OUI';
                    return (
                      <div key={exIdx} className="mb-3">
                        <div className="fw-bold border-bottom mb-1" style={{fontSize: '11px'}}>
                          {nomExamen}
                        </div>
                        <table className="table table-sm table-bordered mb-0">
                          <thead className="table-light">
                            <tr style={{fontSize: '10px'}}>
                              <th>Paramètre</th>
                              <th>Résultat</th>
                              {isBio ? <th>Normes</th> : <th>Interprétation</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {lignes.map((l, lIdx) => (
                              <tr key={lIdx} style={{fontSize: '11px'}}>
                                <td>{l.nom_parametre}</td>
                                <td className="fw-bold">{l.valeur_resultat}</td>
                                <td>{isBio ? l.norme_reference : l.interpretation_sero}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* PIED DE PAGE IMPRESSION */}
          <div className="d-none d-print-block mt-4">
            <div className="d-flex justify-content-between">
              <p className="small italic">Édité le {new Date().toLocaleDateString()}</p>
              <div className="text-center">
                <p className="mb-5 small fw-bold text-decoration-underline">Le Responsable du Laboratoire</p>
                <div style={{height: '60px'}}></div>
              </div>
            </div>
          </div>

        </div>
      ))}
    </div>
  );
}

export default ListeResultatsGroupes;