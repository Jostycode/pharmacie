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

      <div className="table-responsive shadow-sm no-print">
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
        <div className="modal-dialog modal-dialog-scrollable modal-md">
          <div className="modal-content border-0 shadow-lg">
            {/* Header masqué à l'impression */}
            <div className="modal-header bg-success text-white no-print">
              <h5 className="modal-title">🧾 Encaissement : {selectedPatient?.nom}</h5>
              <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            
            <div className="modal-body p-4" id="section-recu">
              {selectedPatient && (
                <>
                  <style>{`
                    @media print {
                      .no-print { display: none !important; }
                      .modal-content { border: none !important; box-shadow: none !important; }
                      body { padding: 0; margin: 0; }
                      
                      /* 2. Réinitialiser le Body pour permettre le scroll sur plusieurs pages */
                      body, html {
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                      }

                      /* 3. Forcer le modal à prendre toute la place et à ne plus être "fixe" */
                      .modal {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        display: block !important; /* Force l'affichage même si JS essaie de le cacher */
                      }

                      .modal-dialog {
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                      }

                      .modal-content {
                        border: none !important;
                        box-shadow: none !important;
                        overflow: visible !important;
                      }

                      /* 4. Ajustement des marges papier */
                      @page {
                        // margin: 1.5cm !important;
                        margin: 0cm !important;
                      }
                    }
                  `}</style>

                  {/* EN-TÊTE DU REÇU */}
                  <div className="text-center mb-4">
                    <h3 className="fw-bold text-uppercase mb-0">DESTINY EXPRESS</h3>
                    <p className="small mb-0">Laboratoire d'Analyses Médicales</p>
                    <p className="small mb-0">Tél : +242 XX XXX XX XX</p>
                    <h5 className="mt-3 border-bottom border-top py-2">REÇU DE CAISSE</h5>
                  </div>

                  <div className="mb-4">
                    <p className="mb-1"><strong>Patient :</strong> {selectedPatient.nom} {selectedPatient.prenom}</p>
                    <p className="mb-1"><strong>Date :</strong> {new Date().toLocaleDateString()}</p>
                  </div>

                  {/* TABLEAU DES DÉTAILS */}
                  <table className="table table-sm border">
                    <thead className="table-light">
                      <tr>
                        <th>Désignation</th>
                        <th className="text-end">Prix (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Ligne Consultation si prix > 0 */}
                      {parseFloat(selectedPatient.prix_consultation) > 0 && (
                        <tr>
                          <td>Consultation</td>
                          <td className="text-end">{Number(selectedPatient.prix_consultation).toLocaleString()}</td>
                        </tr>
                      )}
                      {/* Liste des examens */}
                      {selectedPatient.details_examens?.map((ex, i) => (
                        <tr key={i}>
                          <td>{ex.nom}</td>
                          <td className="text-end">{Number(ex.prix).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="fw-bold">
                        <td>TOTAL GÉNÉRAL</td>
                        <td className="text-end">{Number(selectedPatient.montant_initial).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* RÉSUMÉ FINANCIER */}
                  <div className="mt-4 p-3 bg-light border rounded">
                    <div className="d-flex justify-content-between mb-1">
                      <span>Cumul déjà payé :</span>
                      <span className="fw-bold">{Number(selectedPatient.deja_paye).toLocaleString()} FCFA</span>
                    </div>

                    {/* Saisie montant (masqué à l'impression) */}
                    <div className="no-print my-3 py-2 border-top border-bottom">
                      <label className="form-label fw-bold text-primary">Montant versé ce jour :</label>
                      <div className="input-group">
                        <input 
                          type="number" 
                          className="form-control form-control-lg fw-bold" 
                          value={montantSaisi}
                          onChange={(e) => setMontantSaisi(parseFloat(e.target.value) || 0)}
                        />
                        <span className="input-group-text">FCFA</span>
                      </div>
                    </div>

                    {/* Montant versé affiché seulement à l'impression */}
                    <div className="d-none d-print-block d-flex justify-content-between mb-1">
                      <span>Versé ce jour :</span>
                      <span className="fw-bold">{Number(montantSaisi).toLocaleString()} FCFA</span>
                    </div>

                    <div className="d-flex justify-content-between mt-2 pt-2 border-top">
                      <span className="fw-bold">RESTE À PAYER :</span>
                      <span className="fw-bold text-danger">
                        {Math.max(0, (selectedPatient.montant_initial - selectedPatient.deja_paye - montantSaisi)).toLocaleString()} FCFA
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 d-none d-print-block">
                    <div className="d-flex justify-content-between">
                      <p className="small">Le Caissier</p>
                      <p className="small">Le Client</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer bg-light no-print">
              <button className="btn btn-outline-dark" onClick={() => window.print()}>
                🖨️ Imprimer Reçu
              </button>
              <button className="btn btn-success px-4" onClick={validerPaiement} data-bs-dismiss="modal">
                ✅ Valider le Paiement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Caisse;