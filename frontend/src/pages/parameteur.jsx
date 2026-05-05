import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

function Parameteur() {
  const [data, setData] = useState([]);
  const [nom, setNom] = useState("");
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [tension, setTension] = useState("");
  const [temperature, setTemperature] = useState("");
  const [editId, setEditId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("tous");
  const [selectedDate, setSelectedDate] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "date_creation", direction: "desc" });

  const loadparameteurs = useCallback(async () => {
    try {
      const r = await axios.get(`http://localhost:3000/api/parameteur/`);
      setData(r.data);
    } catch (error) {
      console.error("Erreur parameteurs", error);
    }
  }, []);

  useEffect(() => {
    loadparameteurs();
    socket.on("parameteurs_updated", loadparameteurs);
    return () => socket.off("parameteurs_updated", loadparameteurs);
  }, [loadparameteurs]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter((p) => {
      const dateCrea = new Date(p.date_creation);
      const maintenant = new Date();

      let matchPeriod = true;
      if (filterPeriod === "jour") {
        matchPeriod = dateCrea.toDateString() === maintenant.toDateString();
      } else if (filterPeriod === "selectDay" && selectedDate) {
        matchPeriod = dateCrea.toDateString() === new Date(selectedDate).toDateString();
      } else if (filterPeriod === "mois") {
        matchPeriod = (dateCrea.getMonth() === maintenant.getMonth() && dateCrea.getFullYear() === maintenant.getFullYear());
      } else if (filterPeriod === "annee") {
        matchPeriod = dateCrea.getFullYear() === maintenant.getFullYear();
      }

      const fullSearch = `${p.nom || ''} ${p.prenom || ''}`.toLowerCase();
      const matchSearch = fullSearch.includes(searchTerm.toLowerCase());

      return matchPeriod && matchSearch;
    });

    result.sort((a, b) => {
      let aValue = a[sortConfig.key] || "";
      let bValue = b[sortConfig.key] || "";
      if (sortConfig.key === "date_creation") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [data, searchTerm, filterPeriod, selectedDate, sortConfig]);

  const handlePrint = () => window.print();

  const submit = async (e) => {
    e.preventDefault();
    const payload = { age, poids, tension, temperature }; 
    try {
      if (editId) {
        await axios.put(`http://localhost:3000/api/parameteur/${editId}`, payload);
      } else {
        await axios.post("http://localhost:3000/api/parameteur/post", payload);
      }
      resetForm();
      loadparameteurs();
    } catch (error) { console.error(error); }
  };

  const resetForm = () => {
    setNom(""); setAge(""); setPoids(""); 
    setTension(""); setTemperature(""); 
    setEditId(null);
  };

  const edit = (p) => {
    setNom(`${p.nom} ${p.prenom}`); setAge(p.age); setPoids(p.poids);
    setTension(p.tension || ""); 
    setTemperature(p.temperature || "");
    setEditId(p.id_patient);
  };

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          .no-print, form, .btn, .input-group, .mb-3 { display: none !important; }
          .container { width: 100%; max-width: 100%; }
          table { width: 100%; border: 1px solid black !important; border-collapse: collapse; }
          th, td { border: 1px solid black !important; padding: 10px; }
        }
        .sort-icon { font-size: 0.8rem; margin-left: 5px; color: #aaa; }
        .table-active-sort { background-color: #f8f9fa; }
      `}</style>

      <div className="d-flex justify-content-between align-items-center mb-4 no-print">
        <h3>🩺 Paramètres Vitaux</h3>
        <button onClick={handlePrint} className="btn btn-dark shadow-sm">
          🖨️ Imprimer la liste
        </button>
      </div>

      {/* FORMULAIRE D'EDITION */}
      <form onSubmit={submit} className="card border-0 shadow-sm p-4 mb-4 no-print bg-light">
        <h5 className="mb-3 text-primary">{editId ? "📝 Modification des constantes" : "➕ Saisie des constantes"}</h5>
        <div className="row g-3">
          <div className="col-md-3">
            <label className="small fw-bold">Patient</label>
            <input className="form-control bg-white" value={nom} placeholder="Sélectionnez un patient..." disabled />
          </div>
          <div className="col-md-2">
            <label className="small fw-bold">Âge</label>
            <input className="form-control" type="number" value={age} onChange={(e) => setAge(e.target.value)} required />
          </div>
          <div className="col-md-2">
            <label className="small fw-bold">Poids (kg)</label>
            <input className="form-control" type="number" step="0.1" value={poids} onChange={(e) => setPoids(e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="small fw-bold">Tension (mmHg)</label>
            <input className="form-control" placeholder="ex: 12.8" value={tension} onChange={(e) => setTension(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="small fw-bold">Temp (°C)</label>
            <input className="form-control" type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </div>
          <div className="col-12 text-end">
            {editId && <button type="button" className="btn btn-link text-muted me-2" onClick={resetForm}>Annuler</button>}
            <button className={`btn ${editId ? 'btn-warning' : 'btn-primary'} px-4`}>
              {editId ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      </form>

      {/* FILTRES DE RECHERCHE */}
      <div className="row g-2 mb-3 no-print">
        <div className="col-md-5">
          <div className="input-group">
            <span className="input-group-text bg-white">🔍</span>
            <input type="text" className="form-control border-start-0" placeholder="Rechercher un patient..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="col-md-4">
          <select className="form-select" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
            <option value="tous">📅 Toutes les périodes</option>
            <option value="jour">Aujourd'hui</option>
            <option value="selectDay">Choisir une date...</option>
            <option value="mois">Ce mois-ci</option>
          </select>
        </div>
        {filterPeriod === "selectDay" && (
          <div className="col-md-3">
            <input type="date" className="form-control" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        )}
      </div>

      {/* TABLEAU DES RESULTATS */}
      <div className="card border-0 shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-primary text-nowrap">
              <tr>
                <th onClick={() => requestSort("nom")} style={{ cursor: "pointer" }}>
                  Patient {sortConfig.key === "nom" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "↕️"}
                </th>
                <th className="text-center">Âge</th>
                <th className="text-center">Poids</th>
                <th className="text-center">Tension</th>
                <th className="text-center">Température</th>
                <th className="text-center" onClick={() => requestSort("date_creation")} style={{ cursor: "pointer" }}>
                  Date {sortConfig.key === "date_creation" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : "↕️"}
                </th>
                <th className="text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedData.length > 0 ? (
                filteredAndSortedData.map((p) => (
                  <tr key={p.id_patient}>
                    <td className="fw-bold text-dark">{p.nom} {p.prenom}</td>
                    <td className="text-center">{p.age} ans</td>
                    <td className="text-center">{p.poids ? `${p.poids} kg` : "-"}</td>
                    <td className="text-center">
                       <span className="badge bg-info text-dark px-2">{p.tension || "-"}</span>
                    </td>
                    <td className="text-center">
                      {p.temperature ? (
                        <span className={`fw-bold ${p.temperature > 38 ? 'text-danger' : 'text-success'}`}>
                          {p.temperature}°C
                        </span>
                      ) : "-"}
                    </td>
                    <td className="text-center small text-muted">
                      {new Date(p.date_creation).toLocaleDateString()}
                    </td>
                    <td className="text-center no-print">
                      <button onClick={() => edit(p)} className="btn btn-outline-primary btn-sm rounded-pill">
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="7" className="text-center py-4 text-muted">Aucune donnée disponible pour cette sélection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Parameteur;