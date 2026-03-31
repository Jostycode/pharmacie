import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function DemandeExamen() {
  const [patients, setPatients] = useState([]);
  const [examensDispo, setExamensDispo] = useState([]);
  const [demandes, setDemandes] = useState([]);
  
  // États Formulaire
  const [selectedPatient, setSelectedPatient] = useState("");
  const [examensChoisis, setExamensChoisis] = useState([]); // Tableau d'IDs
  const [searchTerm, setSearchTerm] = useState("");

  const loadInitialData = useCallback(async () => {
    const resP = await axios.get("http://localhost:3000/api/patient");
    const resE = await axios.get("http://localhost:3000/api/examen");
    const resD = await axios.get("http://localhost:3000/api/demande_examen1");
    setPatients(resP.data);
    setExamensDispo(resE.data);
    setDemandes(resD.data);
  }, []);

  useEffect(() => {
    loadInitialData();
    socket.on("demandes_updated", loadInitialData);
    return () => socket.off("demandes_updated", loadInitialData);
  }, [loadInitialData]);

  // Gestion des cases à cocher dans le modal
  const toggleExamen = (id) => {
    setExamensChoisis(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const submitDemande = async () => {
    if (!selectedPatient || examensChoisis.length === 0) {
      alert("Sélectionnez un patient et au moins un examen");
      return;
    }

    try {
      await axios.post("http://localhost:3000/api/demande_examen1/post", {
        id_patient: selectedPatient,
        id_medecin: 1, // À remplacer par l'ID de l'utilisateur connecté
        examens: examensChoisis
      });
      setExamensChoisis([]);
      setSelectedPatient("");
      loadInitialData();
      // Fermer le modal via l'API Bootstrap ou un état
    } catch (error) { console.error(error); }
  };

  return (
    <div className="container mt-4">
      <h3>Nouvelle Demande d'Examen</h3>
      
      <div className="card p-3 shadow-sm mb-4">
        <div className="row align-items-end">
          <div className="col-md-6">
            <label className="form-label">Sélectionner Patient</label>
            <select className="form-select" value={selectedPatient} onChange={(e)=>setSelectedPatient(e.target.value)}>
              <option value="">-- Choisir un patient --</option>
              {patients.map(p => <option key={p.id_patient} value={p.id_patient}>{p.nom} {p.prenom}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <button className="btn btn-primary w-100" data-bs-toggle="modal" data-bs-target="#examenModal">
              ➕ Ajouter des Examens ({examensChoisis.length})
            </button>
          </div>
        </div>
        {selectedPatient && <button onClick={submitDemande} className="btn btn-success mt-3 w-100">Valider la demande</button>}
      </div>

      {/* MODAL BOOTSTRAP */}
      <div className="modal fade" id="examenModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Catalogue des Examens</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div className="modal-body">
              <input type="text" className="form-control mb-3" placeholder="Filtrer un examen..." onChange={(e)=>setSearchTerm(e.target.value)} />
              <div className="list-group" style={{maxHeight: '400px', overflowY: 'auto'}}>
                {examensDispo.filter(ex => ex.nom_examen.toLowerCase().includes(searchTerm.toLowerCase())).map(ex => (
                  <label key={ex.id_examen} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <input 
                        type="checkbox" 
                        className="form-check-input me-2" 
                        checked={examensChoisis.includes(ex.id_examen)}
                        onChange={() => toggleExamen(ex.id_examen)}
                      />
                      {ex.nom_examen}
                    </div>
                    <span className="badge bg-secondary">{ex.categorie}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-primary" data-bs-dismiss="modal">Terminer ({examensChoisis.length})</button>
            </div>
          </div>
        </div>
      </div>

      {/* LISTE DES DERNIÈRES DEMANDES */}
      <h4>Demandes Récentes</h4>
      <table className="table table-striped border">
        <thead>
          <tr>
            <th>ID</th>
            <th>Patient</th>
            <th>Date</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {demandes.map(d => (
            <tr key={d.id_demande}>
              <td>#{d.id_demande}</td>
              <td>{d.nom} {d.prenom}</td>
              <td>{new Date(d.date_demande).toLocaleString()}</td>
              <td><span className="badge bg-warning">{d.statut}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DemandeExamen;