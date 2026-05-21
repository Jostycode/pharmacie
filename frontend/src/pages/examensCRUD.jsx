import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

function ExamenCRUD() {
  const [data, setData] = useState([]);
  const [nomExamen, setNomExamen] = useState("");
  const [categorie, setCategorie] = useState("");
  const [parametre, setParametre] = useState("");
  const [editId, setEditId] = useState(null);
  const [sousCategories, setSousCategories] = useState("");
  const [isBilanMode, setIsBilanMode] = useState(false);
  const [examensInclus, setExamensInclus] = useState([]); // [{id_examen, sous_cat}]
  const [valeursDefaut, setValeursDefaut] = useState("");
  const [prix, setPrix] = useState("");
  const [resultat, setResultat] = useState("");

  const [searchBilan, setSearchBilan] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategorie, setFilterCategorie] = useState("tous");
  const [sortConfig, setSortConfig] = useState({ key: "nom_examen", direction: "asc" });

  const loadExamens = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/examen/`);
      setData(r.data);
    } catch (error) {
      console.error("Erreur chargement examens", error);
      alert("probleme de connexion internet");
    }
  }, []);

  useEffect(() => {
    loadExamens();
    socket.on("examens_updated", loadExamens);
    return () => socket.off("examens_updated", loadExamens);
  }, [loadExamens]);

  const filteredData = useMemo(() => {
    let result = Array.isArray(data) ? data.filter((item) => {
      const matchSearch = item.nom_examen?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = filterCategorie === "tous" || item.categorie === filterCategorie;
      return matchSearch && matchCat;
    }) : [];

    result.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "asc" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [data, searchTerm, filterCategorie, sortConfig]);

  const handleSelectExamenForBilan = (ex) => {
    const isSelected = examensInclus.find(i => i.id_examen === ex.id_examen);
    if (isSelected) {
      setExamensInclus(prev => prev.filter(i => i.id_examen !== ex.id_examen));
    } else {
      const autoSubCat = ex.sous_categories ? ex.sous_categories.split(',')[0].trim() : "Général";
      setExamensInclus(prev => [...prev, { 
        id_examen: ex.id_examen, 
        sous_cat: autoSubCat 
      }]);
    }
  };

  const submit = async (e) => {
    e.preventDefault();

    let finalParametre = "";
    let finalValeursDefaut = "";
    let finalResultat = "";

    if (!isBilanMode) {
      // 1. On sépare les paramètres pour connaître le nombre exact d'éléments attendus
      const arrayParametres = parametre.split(',').map(p => p.trim()).filter(p => p !== "");
      const totalParametres = arrayParametres.length;

      if (totalParametres > 0) {
        // 2. Fonction de secours pour aligner les autres champs (unités, valeurs par défaut)
        const alignerChamps = (chaineBrute) => {
          let chaineSeparee = chaineBrute.split(',').map(item => item.trim());
          let tableauAligne = [];
          
          for (let i = 0; i < totalParametres; i++) {
            // Si l'utilisateur n'a pas fourni assez de valeurs, on met du vide ""
            tableauAligne.push(chaineSeparee[i] || "");
          }
          return tableauAligne.join(', ');
        };

        finalParametre = arrayParametres.join(', ');
        finalValeursDefaut = alignerChamps(valeursDefaut);
        finalResultat = alignerChamps(resultat);
      }
    }

    const payload = {
      nom_examen: nomExamen,
      categorie: isBilanMode ? "BILAN" : categorie,
      parametre: finalParametre,    
      valeurs_defaut: finalValeursDefaut,
      sous_categories: isBilanMode ? "" : sousCategories,
      examens_inclus: isBilanMode ? examensInclus : [],
      prix: prix || 0,
      resultat: finalResultat
    };

    try {
      if (editId) {
        await axios.put(`http://localhost:3000/api/examen/${editId}`, payload);
      } else {
        await axios.post("http://localhost:3000/api/examen/post", payload);
      }
      resetForm();
      loadExamens();
      alert("Catalogue mis à jour !");
    } catch (error) {
      console.error("Erreur:", error.response?.data || error.message);
    }
  };

  const edit = async (ex) => {
    setEditId(ex.id_examen);
    setNomExamen(ex.nom_examen);
    setSousCategories(ex.sous_categories || "");
    setParametre(ex.parametre || "");
    setValeursDefaut(ex.valeurs_defaut || "");
    setPrix(ex.prix || "");
    setResultat(ex.resultat || "");

    if (ex.categorie === 'BILAN') {
      setIsBilanMode(true);
      setCategorie("BILAN");
      try {
        const res = await axios.get(`http://localhost:3000/api/examen/composition/${ex.id_examen}`);
        setExamensInclus(res.data); 
      } catch (error) {
        console.error("Erreur lors du chargement de la composition du bilan", error);
        setExamensInclus([]);
      }
    } else {
      setIsBilanMode(false);
      setCategorie(ex.categorie);
      setExamensInclus([]);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setNomExamen(""); setCategorie(""); setSousCategories(""); setParametre("");
    setValeursDefaut(""); setPrix(""); setResultat(""); setEditId(null);
    setExamensInclus([]); setIsBilanMode(false);
  };

  const toggleArchive = async (id, actuelStatut) => {
    try {
      await axios.patch(`http://localhost:3000/api/examen/archive/${id}`, { statut: !actuelStatut });
      loadExamens();
    } catch (err) { alert("Erreur statut"); }
  };

  return (
    <div className="container mt-4">
      <h3 className="mb-4">⚙️ Configuration du Catalogue</h3>

      <div className="btn-group mb-3 w-100 shadow-sm">
        <button type="button" className={`btn ${!isBilanMode ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => { setIsBilanMode(false); setCategorie(""); }}>🧬 Examen Individuel</button>
        <button type="button" className={`btn ${isBilanMode ? 'btn-success' : 'btn-outline-success'}`} onClick={() => { setIsBilanMode(true); setCategorie("BILAN"); }}>📁 Créer un Bilan</button>
      </div>

      {isBilanMode && (
        <div className="card p-3 border-success mb-3 shadow-sm bg-white">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="fw-bold text-success m-0">Sélectionner les examens (Tire auto la sous-catégorie) :</label>
            <span className="badge bg-success">{examensInclus.length} sélectionné(s)</span>
          </div>
          <input type="text" className="form-control form-control-sm mb-2" placeholder="🔍 Rechercher un examen à inclure..." value={searchBilan} onChange={(e) => setSearchBilan(e.target.value)} />
          <div className="border rounded p-2 bg-light" style={{ maxHeight: '250px', overflowY: 'auto' }}>
            <div className="row g-2">
              {data.filter(ex => ex.categorie !== 'BILAN' && ex.nom_examen.toLowerCase().includes(searchBilan.toLowerCase())).map(ex => {
                const isSelected = examensInclus.find(i => i.id_examen === ex.id_examen);
                return (
                  <div className="col-md-4" key={ex.id_examen}>
                    <div 
                      className={`p-2 border rounded small d-flex align-items-center justify-content-between ${isSelected ? 'bg-success text-white border-success' : 'bg-white'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleSelectExamenForBilan(ex)}
                    >
                      <div className="text-truncate">
                        <div className="fw-bold">{ex.nom_examen}</div>
                        <div className={`x-small ${isSelected ? 'text-white-50' : 'text-muted'}`}>Section: {ex.sous_categories || "Général"}</div>
                      </div>
                      {isSelected && <span>✅</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="card p-3 shadow-sm mb-4 border-0 bg-light">
        <div className="row g-3">
          <div className={isBilanMode ? "col-md-8" : "col-md-4"}>
            <label className="small fw-bold">{isBilanMode ? "Nom du Bilan (Pack)" : "Nom de l'examen"}</label>
            <input className="form-control" value={nomExamen} onChange={(e)=>setNomExamen(e.target.value)} required placeholder="Ex: Bilan Prénatal" />
          </div>
          
          {!isBilanMode && (
            <>
              <div className="col-md-4">
                <label className="small fw-bold">Catégorie</label>
                <input className="form-control" list="list-categories" value={categorie} onChange={(e)=>setCategorie(e.target.value)} required />
              </div>
              <div className="col-md-4">
                <label className="small fw-bold text-primary">Sous-Catégorie (Affichage résultat)</label>
                <input className="form-control border-primary" placeholder="ex: Biochimie" value={sousCategories} onChange={(e)=>setSousCategories(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {!isBilanMode && (
          <div className="row g-3 mt-1">
            <div className="col-md-4">
              <label className="small fw-bold">Paramètres (virgules)</label>
              <input className="form-control" value={parametre} onChange={(e) => setParametre(e.target.value)} placeholder="ex: Cholestérol, HDL" />
            </div>
            <div className="col-md-4">
              <label className="small fw-bold">Unités (virgules)</label>
              <input className="form-control" value={resultat} onChange={(e) => setResultat(e.target.value)} placeholder="ex: mg/dL, %" />
            </div>
            <div className="col-md-4">
              <label className="small fw-bold text-success">Prix (FCFA)</label>
              <input type="number" className="form-control border-success" value={prix} onChange={(e) => setPrix(e.target.value)} />
            </div>
          </div>
        )}

        {isBilanMode && (
          <div className="row mt-3">
             <div className="col-md-4">
              <label className="small fw-bold text-success">Prix Total du Bilan (FCFA)</label>
              <input type="number" className="form-control border-success" value={prix} onChange={(e) => setPrix(e.target.value)} />
            </div>
          </div>
        )}

        <div className="d-flex gap-2 mt-4">
          <button type="submit" className={`btn ${editId ? 'btn-warning' : (isBilanMode ? 'btn-success' : 'btn-primary')} flex-grow-1 fw-bold`}>
            {editId ? "💾 METTRE À JOUR" : "➕ ENREGISTRER DANS LE CATALOGUE"}
          </button>
          {editId && <button type="button" className="btn btn-secondary" onClick={resetForm}>Annuler</button>}
        </div>
      </form>

      <div className="table-responsive bg-white rounded shadow-sm border">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-dark">
            <tr>
              <th>Examen / Bilan</th>
              <th>Catégorie</th>
              <th>Sous-Catégorie</th>
              <th>Prix</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map(ex => (
              <tr key={ex.id_examen} className={!ex.est_actif ? "table-light text-muted" : ""}>
                <td>
                    <div className="fw-bold">{ex.nom_examen}</div>
                    {ex.categorie === 'BILAN' && <small className="text-success text-uppercase" style={{fontSize: '10px'}}>Composé de plusieurs examens</small>}
                </td>
                <td><span className={`badge ${ex.categorie === 'BILAN' ? 'bg-success' : 'bg-info'}`}>{ex.categorie}</span></td>
                <td>{ex.sous_categories || <i className="text-muted small">Via composition</i>}</td>
                <td className="fw-bold">{ex.prix} FCFA</td>
                <td className="text-center">
                    <div className="d-flex justify-content-center gap-2">
                        <div className="form-check form-switch pt-1">
                            <input className="form-check-input" type="checkbox" checked={ex.est_actif !== false} onChange={() => toggleArchive(ex.id_examen, ex.est_actif !== false)} />
                        </div>
                        <button onClick={() => edit(ex)} className="btn btn-sm btn-outline-warning">✏️</button>
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ExamenCRUD;