import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

function Parameteur() {
  const [data, setData] = useState([]);
  const [nom, setNom] = useState("");
  const [age, setAge] = useState("");
  const [poids, setPoids] = useState("");
  const [editId, setEditId] = useState(null);

  // --- États pour le filtrage et tri ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("tous");
  const [selectedDate, setSelectedDate] = useState(""); // Pour le calendrier spécifique
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

  // --- Logique de Tri ---
  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // --- LOGIQUE DE FILTRAGE ET TRI ---
  const filteredAndSortedData = useMemo(() => {
    let result = data.filter((p) => {
      const dateCrea = new Date(p.date_creation);
      const maintenant = new Date();

      // 1. Filtre par période
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

      // 2. Filtre par recherche
      const fullSearch = `${p.nom} ${p.prenom}`.toLowerCase();
      const matchSearch = fullSearch.includes(searchTerm.toLowerCase());

      return matchPeriod && matchSearch;
    });

    // 3. Tri
    result.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

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

  const handlePrint = () => {
    window.print();
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = { age, poids };
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
    setNom(""); setAge(""); setPoids(""); setEditId(null);
  };

  const edit = (p) => {
    setNom(p.nom); setAge(p.age); setPoids(p.poids);
    setEditId(p.id_patient);
  };

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          .no-print, form, button, .mb-3 { display: none !important; }
          .container { width: 100%; max-width: 100%; margin: 0; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        }
      `}</style>

      <h3 className="mb-4 no-print">Gestion des Paramètres Patients</h3>

      {/* FORMULAIRE (caché à l'impression) */}
      <form onSubmit={submit} className="card p-3 shadow-sm mb-4 no-print">
        <div className="row">
          <div className="col-md-4 mb-2">
            <input className="form-control" placeholder="Nom (Lecture seule)" value={nom} disabled />
          </div>
          <div className="col-md-4 mb-2">
            <input className="form-control" type="number" placeholder="Age" value={age} onChange={(e) => setAge(e.target.value)} required />
          </div>
          <div className="col-md-4 mb-2">
            <input className="form-control" type="number" placeholder="Poids" value={poids} onChange={(e) => setPoids(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary w-100">{editId ? "Mettre à jour" : "Ajouter"}</button>
      </form>

      {/* CONTROLES (cachés à l'impression) */}
      <div className="row mb-3 g-2 no-print">
        <div className="col-md-4">
          <input type="text" className="form-control" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="col-md-3">
          <select className="form-select" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
            <option value="tous">Toutes les dates</option>
            <option value="jour">Aujourd'hui</option>
            <option value="selectDay">Choisir un jour précis</option>
            <option value="mois">Ce mois-ci</option>
            <option value="annee">Cette année</option>
          </select>
        </div>
        {filterPeriod === "selectDay" && (
          <div className="col-md-3">
            <input type="date" className="form-control" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        )}
        <div className="col-md-2">
          <button onClick={handlePrint} className="btn btn-secondary w-100">
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* TABLEAU */}
      <div className="table-responsive">
        <h4 className="d-none d-print-block text-center mb-4">Liste des Paramètres Patients</h4>
        <table className="table table-hover border">
          <thead className="table-light">
            <tr>
              <th onClick={() => requestSort("nom")} style={{ cursor: "pointer" }}>
                Nom & Prénom {sortConfig.key === "nom" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : ""}
              </th>
              <th>Age</th>
              <th>Poids (kg)</th>
              <th onClick={() => requestSort("date_creation")} style={{ cursor: "pointer" }}>
                Date Enr. {sortConfig.key === "date_creation" ? (sortConfig.direction === "asc" ? "🔼" : "🔽") : ""}
              </th>
              <th className="no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((p) => (
                <tr key={p.id_patient}>
                  <td>{p.nom} {p.prenom}</td>
                  <td>{p.age} ans</td>
                  <td>{p.poids} kg</td>
                  <td>{new Date(p.date_creation).toLocaleDateString()}</td>
                  <td className="no-print">
                    <button onClick={() => edit(p)} className="btn btn-warning btn-sm">Modifier</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" className="text-center">Aucun résultat trouvé</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Parameteur;