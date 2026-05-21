import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Logo from "../assets/logo.png";

function ListeResultatsGroupes() {
  const [resultats, setResultats] = useState([]);
  const [search, setSearch] = useState("");
  const [printingId, setPrintingId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("http://localhost:3000/api/resultats/complets");
        setResultats(res.data);
      } catch (err) {
        console.error("Erreur de chargement dans le composant:", err);
        alert("probleme de connexion internet");
      }
    };
    fetchData();
  }, []);

  const demandesGroupees = useMemo(() => {
    if (!resultats || resultats.length === 0) return [];

    const dossiers = {};

    resultats.forEach((ligne) => {
      const idDossier = `${ligne.id_patient}_${ligne.id_demande}`;
      
      if (!dossiers[idDossier]) {
        dossiers[idDossier] = {
          idUnique: idDossier,
          // Récupération de l'âge et du sexe depuis la ligne SQL
          patient: { 
            nom: ligne.nom, 
            prenom: ligne.prenom, 
            date: ligne.date_demande,
            age: ligne.age,
            sexe: ligne.sexe 
          },
          categories: {}
        };
      }

      // 1. Catégorie principale (ex: BIOCHIMIE)
      const nomCat = (ligne.categorie === "BILAN" ? "BIOCHIMIE" : ligne.categorie || "BIOCHIMIE").toUpperCase().trim();
      if (!dossiers[idDossier].categories[nomCat]) {
        dossiers[idDossier].categories[nomCat] = {};
      }

      // 2. REGROUPEMENT PAR SOUS-CATÉGORIE MÉDICALE
      let section = ligne.sous_categories;
      if (section && typeof section === "string") {
        section = section.trim();
      }

      // Si la sous-catégorie est vide ou générique, on applique le dictionnaire intelligent
      if (!section || section === "" || section.toLowerCase() === "autres" || section.toLowerCase().includes("visite")) {
        const param = (ligne.nom_parametre || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, ""); 

        if (param.includes("cholest") || param.includes("ldl") || param.includes("hdl") || param.includes("trigly") || param.includes("lipid")) {
          section = "BILAN LIPIDIQUE";
        } else if (param.includes("creat") || param.includes("uree") || param.includes("renal") || param.includes("acide urique")) {
          section = "BILAN LIPIDIQUE"; 
        } else if (param.includes("glyc") || param.includes("gluc") || param.includes("hba1c") || param.includes("diabete")) {
          section = "BILAN GLUCIDIQUE";
        } else if (param.includes("tgo") || param.includes("tgp") || param.includes("asat") || param.includes("alat") || param.includes("hepat")) {
          section = "BILAN HÉPATIQUE";
        } else if (param.includes("iono") || param.includes("sod") || param.includes("potas") || param.includes("chlor")) {
          section = "IONOGRAMME";
        } else {
          section = "AUTRES ANALYSES";
        }
      } else {
        section = section.toUpperCase();
      }

      if (!dossiers[idDossier].categories[nomCat][section]) {
        dossiers[idDossier].categories[nomCat][section] = [];
      }

      const existe = dossiers[idDossier].categories[nomCat][section].some(
        (p) => p.nom_parametre === ligne.nom_parametre && p.valeur_resultat === ligne.valeur_resultat
      );

      if (!existe) {
        dossiers[idDossier].categories[nomCat][section].push(ligne);
      }
    });

    return Object.values(dossiers).filter((d) =>
      `${d.patient.nom} ${d.patient.prenom}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [resultats, search]);

  const imprimer = (id) => {
    setPrintingId(id);
    setTimeout(() => {
      window.print();
      setPrintingId(null);
    }, 300);
  };

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .card { border: none !important; box-shadow: none !important; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th, td { border: 1px solid #dee2e6 !important; padding: 6px !important; font-size: 12px; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      {/* Barre de recherche (Écran uniquement) */}
      <div className="mb-4 no-print bg-white p-3 shadow-sm border rounded">
        <input
          type="text"
          className="form-control"
          placeholder="Rechercher un patient..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {demandesGroupees.map((d) => (
        <div key={d.idUnique} className={`card mb-5 ${printingId === d.idUnique ? "" : printingId ? "d-none" : ""}`}>
          
          {/* EN-TÊTE D'IMPRESSION MUTÉ DANS LA BOUCLE PATIENT */}
          <div className="d-none d-print-block p-3">
            <div className="row align-items-center border-bottom pb-3">
              <div className="col-4">
                <div className="d-flex">
                  <img src={Logo} style={{ width: '80px' }} alt="Logo" />
                  <h4 className="fw-bold mt-2 text-uppercase ms-2">destiny express</h4>
                </div>
                <p className="small mb-0">votre santé notre priorité</p>
                <p className="small mb-0">Tél : +242 XX XXX XX XX</p>
              </div>
              <div className="col-4 text-center">
                <h2 className="text-uppercase fw-bold">Rapport</h2>
              </div>
              <div className="col-4 text-end">
                <p className="mb-0">Date d'édition : {new Date().toLocaleDateString()}</p>
                <p className="mb-0">Heure : {new Date().toLocaleTimeString()}</p>
              </div>
            </div>

            {/* BLOC INFOS PATIENT RAJOUTÉ ICI */}
            <div className="row my-3 p-2 bg-light rounded border" style={{ fontSize: "14px" }}>
              <div className="col-6">
                <p className="mb-1"><strong>Nom & Prénom :</strong> {d.patient.nom} {d.patient.prenom}</p>
                <p className="mb-0"><strong>Date de la demande :</strong> {d.patient.date ? new Date(d.patient.date).toLocaleDateString() : "-"}</p>
              </div>
              <div className="col-6 text-end">
                <p className="mb-1"><strong>Âge :</strong> {d.patient.age || "-"} ans</p>
                <p className="mb-0"><strong>Sexe :</strong> {d.patient.sexe || "-"}</p>
              </div>
            </div>

            <h3 className="text-center mt-3 text-decoration-underline">SERVICE LABORATOIRE</h3>
          </div>

          <div className="card-header bg-primary text-white d-flex justify-content-between no-print">
            <strong>{d.patient.nom} {d.patient.prenom}</strong>
            <button className="btn btn-sm btn-light" onClick={() => imprimer(d.idUnique)}>
              🖨️ Imprimer le rapport
            </button>
          </div>

          <div className="card-body">
            {Object.entries(d.categories).map(([nomCat, sousCats]) => (
              <div key={nomCat} className="mb-4">
                {/* BLOC CATÉGORIE PRINCIPALE */}
                <div className="bg-dark text-white p-2 mb-2 text-uppercase fw-bold text-center">DEPARTEMENT {nomCat}</div>

                {/* LES SOUS-TABLEAUX SÉPARÉS */}
                {Object.entries(sousCats).map(([nomSousCat, params]) => (
                  <div key={nomSousCat} className="mt-4">
                    <div className="border-start border-primary border-4 ps-2 fw-bold bg-light py-1 mb-2 text-uppercase">
                      {nomSousCat}
                    </div>
                    
                    <table className="table table-bordered table-sm">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: "45%" }}>Analyse</th>
                          <th className="text-center" style={{ width: "25%" }}>Résultat</th>
                          <th className="text-center" style={{ width: "30%" }}>Normes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {params.map((p, i) => (
                          <tr key={i}>
                            <td className="align-middle">{p.nom_parametre}</td>
                            <td className="text-center fw-bold align-middle" style={{ fontSize: "1.05rem" }}>
                              {p.valeur_resultat || "-"}
                            </td>
                            <td className="text-center small text-muted align-middle">
                              {p.norme_reference || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ListeResultatsGroupes;