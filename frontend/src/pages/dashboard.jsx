import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import socket from "../socket";

// Importation des éléments nécessaires pour les graphiques Chart.js
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // --- ÉTATS POUR LES FILTRES D'INTERVALLE ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- ÉTATS POUR LES MODALES DE DÉTAILS ---
  const [showVentesModal, setShowVentesModal] = useState(false); // Nouvelle modale
  const [showRuptureModal, setShowRuptureModal] = useState(false);
  const [showCritiqueModal, setShowCritiqueModal] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try { setCurrentUser(JSON.parse(storedUser)); } catch (e) { console.error(e); }
    }
  }, []);

  const getStructureId = useCallback(() => {
    return localStorage.getItem("id_structure") || currentUser?.id_structure;
  }, [currentUser]);

  const getAxiosConfig = useCallback(() => {
    const idStructure = getStructureId();
    if (!idStructure) return {};
    
    return { 
      headers: { "id_structure": idStructure },
      params: {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      }
    };
  }, [getStructureId, startDate, endDate]);

  const loadStats = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("http://192.168.100.34:3000/api/dashboard/stats", getAxiosConfig());
      setStats(r.data);
    } catch (error) {
      console.error("Erreur chargement statistiques dashboard", error);
    }
  }, [getStructureId, getAxiosConfig]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    const handleRefresh = () => loadStats();
    socket.on("refresh_data", handleRefresh);

    return () => { socket.off("refresh_data", handleRefresh); };
  }, [getStructureId, loadStats]);

  // --- CONFIGURATION DES GRAPHIQUES ---
  const lineChartData = {
    labels: stats?.evolution_ca?.map(item => new Date(item.date_vente).toLocaleDateString("fr-FR", { weekday: 'short', day: 'numeric' })) || [],
    datasets: [
      {
        label: "Chiffre d'affaires (FCFA)",
        data: stats?.evolution_ca?.map(item => parseFloat(item.total_ventes)) || [],
        borderColor: "#0d6efd",
        backgroundColor: "rgba(13, 110, 253, 0.1)",
        tension: 0.3,
        fill: true,
      }
    ]
  };

  const barChartData = {
    labels: stats?.top_ventes?.map(item => item.nom) || [],
    datasets: [
      {
        label: "Quantités vendues",
        data: stats?.top_ventes?.map(item => item.quantite_vendue) || [],
        backgroundColor: "#198754",
      }
    ]
  };

  if (!stats) {
    return (
      <div className="container mt-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Chargement des indicateurs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3>Tableau de Bord Structure</h3>
          <span className="badge bg-secondary p-2">Rôle : {currentUser?.role || "Utilisateur"}</span>
        </div>

        {/* --- ZONE DU FILTRE D'INTERVALLE DE DATES --- */}
        <div className="card p-2 shadow-sm border-0 bg-light">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="small fw-bold text-muted">Période :</span>
            <input type="date" className="form-control form-control-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="small text-muted">au</span>
            <input type="date" className="form-control form-control-sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            {(startDate || endDate) && (
              <button className="btn btn-outline-danger btn-sm" onClick={() => { setStartDate(""); setEndDate(""); }}>Effacer</button>
            )}
          </div>
        </div>
      </div>

      {/* --- CARTES DE VUE D'ENSEMBLE (KPIs) --- */}
      <div className="row g-3 mb-4">
        {/* Carte CA (RENDUE CLIQUABLE 🔍) */}
        <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => setShowVentesModal(true)}>
          <div className="card shadow-sm border-0 bg-primary text-white p-3 h-100 hover-shadow">
            <div className="small text-uppercase text-white-50 fw-bold">Ventes sur la période</div>
            <div className="display-6 fw-bold my-2">
              {stats.indicateurs.ca_aujourdhui.toLocaleString()} <span className="fs-5">FCFA</span>
            </div>
            <div className="small text-white-50">Cliquez pour voir le détail des articles 🔍</div>
          </div>
        </div>

        {/* Carte Ruptures */}
        <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => setShowRuptureModal(true)}>
          <div className="card shadow-sm border-0 bg-danger text-white p-3 h-100 position-relative hover-shadow">
            <div className="small text-uppercase text-white-50 fw-bold">Médicaments en Rupture</div>
            <div className="display-6 fw-bold my-2">{stats.indicateurs.produits_rupture}</div>
            <div className="small text-white-50">Cliquez pour voir les détails 🔍</div>
          </div>
        </div>

        {/* Carte Périssables critiques */}
        <div className="col-md-4" style={{ cursor: 'pointer' }} onClick={() => setShowCritiqueModal(true)}>
          <div className="card shadow-sm border-0 bg-warning text-dark p-3 h-100 hover-shadow">
            <div className="small text-uppercase text-muted fw-bold">Lots Critiques (≤ 30j)</div>
            <div className="display-6 fw-bold my-2">{stats.indicateurs.lots_critiques}</div>
            <div className="small text-muted">Cliquez pour voir les détails 🔍</div>
          </div>
        </div>
      </div>

      {/* --- GRAPHIQUES --- */}
      <div className="row g-4 mb-5">
        <div className="col-md-7">
          <div className="card p-3 shadow-sm h-100">
            <h5 className="card-title fw-bold text-secondary mb-3">📈 Activité Commerciale</h5>
            <div style={{ minHeight: "250px" }}>
              <Line data={lineChartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>

        <div className="col-md-5">
          <div className="card p-3 shadow-sm h-100">
            <h5 className="card-title fw-bold text-secondary mb-3">🏆 Top 5 des Ventes</h5>
            <div style={{ minHeight: "250px" }}>
              <Bar data={barChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALE DÉTAILS DES VENTIFS / ARTICLES VENDUS ================= */}
      {showVentesModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-xl modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">📋 Journal des articles vendus sur la période</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowVentesModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {stats.liste_ventes_details && stats.liste_ventes_details.length > 0 ? (
                  <table className="table table-striped table-hover align-middle small">
                    <thead className="table-dark">
                      <tr>
                        <th>Date & Heure</th>
                        <th>Médicament</th>
                        <th className="text-center">Quantité</th>
                        <th className="text-end">Prix Unit. Vendu</th>
                        <th className="text-end">Total Ligne</th>
                        <th>Paiement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.liste_ventes_details.map((v, index) => (
                        <tr key={index}>
                          <td>{new Date(v.date_vente).toLocaleString("fr-FR")}</td>
                          <td className="fw-bold text-primary">{v.nom_produit}</td>
                          <td className="text-center fw-bold">{v.quantite}</td>
                          <td className="text-end">{parseFloat(v.prix_unitaire_vendu).toLocaleString()} FCFA</td>
                          <td className="text-end fw-bold text-success">{(v.quantite * v.prix_unitaire_vendu).toLocaleString()} FCFA</td>
                          <td><span className="badge bg-light text-dark">{v.mode_paiement}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center my-3 text-muted">Aucune vente enregistrée sur cette période. 🪙</p>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowVentesModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE RUPTURES DE STOCK ================= */}
      {showRuptureModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title fw-bold">⚠️ Liste des produits en rupture de stock</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowRuptureModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {stats.liste_ruptures && stats.liste_ruptures.length > 0 ? (
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Nom du médicament</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.liste_ruptures.map((prod, index) => (
                        <tr key={index}><td className="fw-bold text-secondary">{prod.nom}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center my-3 text-muted">Aucun produit en rupture complète ! 🎉</p>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRuptureModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODALE LOTS CRITIQUES ================= */}
      {showCritiqueModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-warning text-dark">
                <h5 className="modal-title fw-bold">⏳ Alertes de Péremption & Lots Critiques</h5>
                <button type="button" className="btn-close" onClick={() => setShowCritiqueModal(false)}></button>
              </div>
              <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {stats.liste_critiques && stats.liste_critiques.length > 0 ? (
                  <table className="table table-hover align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Médicament</th>
                        <th>Numéro de Lot</th>
                        <th>Quantité Restante</th>
                        <th>Date Péremption</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.liste_critiques.map((lot, index) => (
                        <tr key={index}>
                          <td className="fw-bold">{lot.nom_produit}</td>
                          <td><code>{lot.id_lot}</code></td>
                          <td className="text-end">{lot.quantite_disponible}</td>
                          <td>{new Date(lot.date_peremption).toLocaleDateString("fr-FR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center my-3 text-muted">Aucun lot critique. 👍</p>
                )}
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowCritiqueModal(false)}>Fermer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;