import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";

function Caisse() {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("tous");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [montantSaisi, setMontantSaisi] = useState(0);

  const loadCaisse = useCallback(async () => {
    try {
      const r = await axios.get("http://localhost:3000/api/caisse/");
      setData(r.data);
    } catch (error) {
      console.error("Erreur chargement:", error.message);
    }
  }, []);

  useEffect(() => {
    loadCaisse();
    socket.on("patients_updated", loadCaisse);
    return () => socket.off("patients_updated", loadCaisse);
  }, [loadCaisse]);

  // Préparation du modal
  // Dans ton composant Caisse, modifie ouvrirModal :
  const ouvrirModal = (patient) => {
    setSelectedPatient(patient);
    // On propose par défaut de payer le RESTANT (montant_initial - deja_paye)
    const restant = parseFloat(patient.montant_initial) - parseFloat(patient.deja_paye);
    setMontantSaisi(restant > 0 ? restant : 0);
  };

  // Modifie validerPaiement :
  const validerPaiement = async () => {
    if (!selectedPatient || montantSaisi <= 0) return;
    
    try {
      await axios.put(`http://localhost:3000/api/caisse/payer/${selectedPatient.id_patient}`, {
        nouveau_versement: montantSaisi,
        total_du: selectedPatient.montant_initial
      });
      loadCaisse();
    } catch (error) {
      console.error("Erreur paiement:", error);
    }
  };

  const filteredAndSortedData = useMemo(() => {
    return data.filter((p) => {
      if (parseFloat(p.total_a_payer) <= 0) return false;
      const searchContent = `${p.nom} ${p.prenom}`.toLowerCase();
      return searchContent.includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(b.date_creation) - new Date(a.date_creation));
  }, [data, searchTerm]);

  return (
    <div className="container mt-4">
      <h3 className="mb-4 no-print">💰 Gestion de la Caisse</h3>

      {/* ... (Filtres identiques à ton code précédent) */}

      <div className="table-responsive shadow-sm">
        <table className="table table-bordered table-hover align-middle">
          <thead className="table-dark text-center">
            <tr>
              <th>Nom du Patient</th>
              <th>Montant Initial</th>
              <th>Déjà Payé</th>
              <th>Montant Restant</th>
              <th className="no-print">Statut</th>
              <th className="no-print">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedData.map((p) => (
              <tr key={p.id_patient} className={p.statut_paye === 'avance' ? 'table-warning' : ''}>
                <td className="fw-bold">
                  {p.nom} {p.prenom}
                  <div className="small text-muted">{p.telephone}</div>
                </td>
                
                {/* MONTANT INITIAL */}
                <td className="text-end fw-bold text-primary">
                  {Number(p.montant_initial).toLocaleString()} FCFA
                </td>

                {/* DÉJÀ PAYÉ */}
                <td className="text-end text-success">
                  {Number(p.deja_paye).toLocaleString()} FCFA
                </td>

                {/* MONTANT RESTANT */}
                <td className="text-end fw-bold text-danger bg-light">
                  {Number(p.montant_restant).toLocaleString()} FCFA
                </td>

                <td className="text-center no-print">
                  <span className={`badge ${p.statut_paye === 'avance' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                    {p.statut_paye.toUpperCase()}
                  </span>
                </td>

                <td className="text-center no-print">
                  <button 
                    className="btn btn-sm btn-success shadow-sm" 
                    data-bs-toggle="modal" 
                    data-bs-target="#modalPaiement"
                    onClick={() => ouvrirModal(p)}
                  >
                    💵 Encaisser
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE PAIEMENT & REÇU */}
      <div className="modal fade" id="modalPaiement" tabIndex="-1">
        <div className="modal-dialog modal-md">
          <div className="modal-content border-0 shadow-lg">
            <div className="modal-header bg-success text-white">
              <h5 className="modal-title">🧾 Encaissement : {selectedPatient?.nom}</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            
            <div className="modal-body p-4" id="section-recu">
              {selectedPatient && (
                <>
                  <div className="text-center mb-4">
                    <h4 className="fw-bold">DESTINY EXPRESS</h4>
                    <p className="small text-muted">Reçu de caisse</p>
                    <hr />
                  </div>

                  <div className="d-flex justify-content-between mb-2">
                    <span>Total de l'acte :</span>
                    <span className="fw-bold">{Number(selectedPatient.montant_initial || 0).toLocaleString()} FCFA</span>
                  </div>
                  
                  <div className="d-flex justify-content-between mb-2 text-success">
                    <span>Déjà versé :</span>
                    <span>{Number(selectedPatient.deja_paye || 0).toLocaleString()} FCFA</span>
                  </div>

                  <div className="mb-3 no-print mt-3">
                    <label className="form-label fw-bold text-primary">Nouveau versement :</label>
                    <div className="input-group">
                      <input 
                        type="number" 
                        className="form-control form-control-lg fw-bold border-primary" 
                        value={montantSaisi}
                        onChange={(e) => setMontantSaisi(parseFloat(e.target.value) || 0)}
                        onFocus={(e) => e.target.select()} // Pratique pour effacer vite
                      />
                      <span className="input-group-text bg-primary text-white">FCFA</span>
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded border mt-4">
                    <div className="d-flex justify-content-between mb-1">
                      <span className="fw-bold">Reste après ce versement :</span>
                      <span className="fw-bold text-danger">
                        {Math.max(0, (selectedPatient.montant_initial || 0) - (selectedPatient.deja_paye || 0) - montantSaisi).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer bg-light no-print">
              <button className="btn btn-outline-dark" onClick={() => window.print()}>🖨️ Imprimer</button>
              <button className="btn btn-success px-4" onClick={validerPaiement} data-bs-dismiss="modal">
                ✅ Confirmer l'encaissement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Caisse;