import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import socket from "../socket";
import Logo from "../assets/logo.png"; // On réutilise ton logo pour l'en-tête de facture
import { Modal } from 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function Caisse() {
  const [produits, setProduits] = useState([]);
  const [panier, setPanier] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [modePaiement, setModePaiement] = useState("ESPECES");
  const [currentUser, setCurrentUser] = useState(null);
  const [structureInfo, setStructureInfo] = useState(null);
  const [abonnements, setAbonnements] = useState([]); // État pour stocker la liste des abonnements

  // --- ÉTATS POUR L'HISTORIQUE ET LA FACTURE ---
  const [ventesRecentes, setVentesRecentes] = useState([]);
  const [venteSelectionnee, setVenteSelectionnee] = useState(null);

  // Récupération de l'utilisateur et de la structure depuis le localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);
        
        // Si les infos de la structure sont imbriquées dans l'objet utilisateur
        if (parsedUser?.structure) {
          setStructureInfo(parsedUser.structure);
        }
      } catch (e) {
        console.error("Erreur de lecture du user", e);
      }
    }

    // Alternative : Si vous stockez directement l'objet structure séparément
    const storedStructure = localStorage.getItem("structure");
    if (storedStructure) {
      try {
        setStructureInfo(JSON.parse(storedStructure));
      } catch (e) {
        console.error("Erreur de lecture de la structure", e);
      }
    }
  }, []);

  const getStructureId = useCallback(() => {
    // Regarder directement dans le localStorage d'abord
    const localId = localStorage.getItem("id_structure");
    if (localId) return localId;

    // Regarder dans l'état structureInfo chargé
    if (structureInfo?.id_structure) return structureInfo.id_structure;

    // Sinon, regarder subsidiairement dans l'objet user du localStorage
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        return parsed?.id_structure || parsed?.structure?.id_structure;
      } catch (e) {
        console.error(e);
      }
    }
    
    return currentUser?.id_structure;
  }, [currentUser, structureInfo]);

  const getAxiosConfig = useCallback(() => {
    const idStructure = getStructureId();
    if (!idStructure) return {};
    return { headers: { "id_structure": idStructure } };
  }, [getStructureId]);

  // Chargement des produits
  const loadProduits = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("http://192.168.100.34:3000/api/produit", getAxiosConfig());
      setProduits(r.data);
    } catch (error) {
      console.error("Erreur chargement produits caisse", error);
    }
  }, [getStructureId, getAxiosConfig]);

  // Chargement des ventes récentes
  const loadVentesRecentes = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const r = await axios.get("http://192.168.100.34:3000/api/vente", getAxiosConfig());
      setVentesRecentes(r.data);
    } catch (error) {
      console.error("Erreur chargement historique ventes", error);
    }
  }, [getStructureId, getAxiosConfig]);

  // Chargement des abonnements (Intégré depuis votre code du bas)
  const loadAbonnements = useCallback(async () => {
    const idStructure = getStructureId();
    if (!idStructure) return;
    try {
      const response = await axios.get("http://192.168.100.34:3000/api/abonnement", getAxiosConfig());
      setAbonnements(response.data);
    } catch (error) {
      console.error("Erreur de chargement des abonnements", error);
    }
  }, [getStructureId, getAxiosConfig]);

  useEffect(() => {
    const idStructure = getStructureId();
    if (!idStructure) return;

    loadProduits();
    loadVentesRecentes();
    loadAbonnements();

    const handleRefresh = () => {
      loadProduits();
      loadVentesRecentes();
      loadAbonnements();
    };
    socket.on("refresh_data", handleRefresh);

    return () => {
      socket.off("refresh_data", handleRefresh);
    };
  }, [getStructureId, loadProduits, loadVentesRecentes, loadAbonnements]);

  // --- RECHERCHE ET UTILS ---
  const produitsFilitres = useMemo(() => {
    if (!searchTerm) return [];
    return produits.filter((p) =>
      p.nom?.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 5);
  }, [produits, searchTerm]);

  // --- GESTION DU PANIER ---
  const ajouterAuPanier = (produit) => {
    const stockTotal = parseInt(produit.stock_total, 10);
    if (stockTotal <= 0) {
      alert("Ce produit est en rupture de stock !");
      return;
    }

    setPanier((prevPanier) => {
      const existe = prevPanier.find((item) => item.id_produit === produit.id_produit);
      if (existe) {
        if (existe.quantite_panier >= stockTotal) {
          alert(`Impossible d'ajouter plus. Stock max disponible : ${stockTotal}`);
          return prevPanier;
        }
        return prevPanier.map((item) =>
          item.id_produit === produit.id_produit
            ? { ...item, quantite_panier: item.quantite_panier + 1 }
            : item
        );
      }
      return [...prevPanier, { ...produit, quantite_panier: 1 }];
    });
    setSearchTerm("");
  };

  const changerQuantitePanier = (id_produit, nouvelleQuantite, stockTotal) => {
    const qte = parseInt(nouvelleQuantite, 10);
    if (isNaN(qte) || qte <= 0) return;

    if (qte > parseInt(stockTotal, 10)) {
      alert(`Le stock disponible est insuffisant (${stockTotal} max).`);
      return;
    }

    setPanier((prev) =>
      prev.map((item) =>
        item.id_produit === id_produit ? { ...item, quantite_panier: qte } : item
      )
    );
  };

  const supprimerDuPanier = (id_produit) => {
    setPanier((prev) => prev.filter((item) => item.id_produit !== id_produit));
  };

  const totalGeneral = useMemo(() => {
    return panier.reduce(
      (sum, item) => sum + parseFloat(item.prix_vente_unitaire) * item.quantite_panier,
      0
    );
  }, [panier]);

  // --- PREPARER L'IMPRESSION D'UNE FACTURE EXISTANTE ---
  const handleOuvrirFacture = async (vente) => {
    try {
      const res = await axios.get(`http://192.168.100.34:3000/api/vente/details/${vente.id_vente}`, getAxiosConfig());
      setVenteSelectionnee({
        ...vente,
        items: res.data
      });

      const modalElement = document.getElementById("factureModal");
      const modalInstance = new Modal(modalElement); 
      modalInstance.show();
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la récupération des détails de la facture.");
    }
  };

  // --- SOUMISSION DE LA VENTE & IMPRESSION AUTO ---
  const validerVente = async (e) => {
    e.preventDefault();
    const idStructure = getStructureId();
    
    if (!idStructure) {
      return alert("Erreur : L'identifiant de la structure est introuvable. Veuillez vous reconnecter.");
    }
    if (panier.length === 0) return alert("Le panier est vide.");

    const articles = panier.map((item) => ({
      id_produit: item.id_produit,
      quantite: item.quantite_panier,
    }));

    const payload = {
      id_structure: idStructure, 
      id_utilisateur: currentUser?.id_utilisateur,
      mode_paiement: modePaiement,
      articles,
    };

    try {
      const resVente = await axios.post(
        "http://192.168.100.34:3000/api/vente", 
        payload, 
        { headers: { "id_structure": idStructure } }
      );
      
      alert("Vente enregistrée avec succès !");
      
      setPanier([]);
      loadProduits();
      loadVentesRecentes();

      if (resVente.data && resVente.data.id_vente) {
        const prepVenteObj = {
          id_vente: resVente.data.id_vente,
          total: resVente.data.total,
          mode_paiement: resVente.data.mode_paiement || modePaiement,
          date_vente: resVente.data.date_vente || new Date().toISOString()
        };
        handleOuvrirFacture(prepVenteObj);
      }
    } catch (error) {
      alert("Erreur lors de la vente : " + (error.response?.data?.error || error.message));
    }
  };

  const handlePrintFacture = () => {
    window.print();
  };

  return (
    <div className="container mt-4">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .modal-print-content, .modal-print-content * {
            visibility: visible;
          }
          .modal-print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print-btn {
            display: none !important;
          }
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>

      <h3 className="mb-4 no-print">Interface de Caisse</h3>

      <div className="row no-print">
        {/* Colonne de gauche : Recherche & Panier */}
        <div className="col-md-8 mb-4">
          <div className="card p-3 shadow-sm mb-3 position-relative">
            <h5 className="card-title fw-bold">Recherche de médicaments</h5>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Tapez le nom du produit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {produitsFilitres.length > 0 && (
              <ul className="list-group position-absolute left-0 w-100 shadow-lg" style={{ zIndex: 1000, top: "75px" }}>
                {produitsFilitres.map((p) => (
                  <button
                    key={p.id_produit}
                    type="button"
                    className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                    onClick={() => ajouterAuPanier(p)}
                  >
                    <span className="fw-bold">{p.nom}</span>
                    <span>
                      {parseFloat(p.prix_vente_unitaire).toLocaleString()} FCFA | Stock:{" "}
                      <strong className={parseInt(p.stock_total, 10) <= 5 ? "text-danger" : "text-success"}>
                        {p.stock_total}
                      </strong>
                    </span>
                  </button>
                ))}
              </ul>
            )}
          </div>

          {/* Liste des articles dans le panier */}
          <div className="card p-3 shadow-sm">
            <h5 className="card-title fw-bold mb-3">Panier en cours</h5>
            <div className="table-responsive">
              <table className="table border align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Produit</th>
                    <th>Prix</th>
                    <th style={{ width: "120px" }}>Quantité</th>
                    <th>Sous-total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {panier.map((item) => (
                    <tr key={item.id_produit}>
                      <td className="fw-bold">{item.nom}</td>
                      <td>{parseFloat(item.prix_vente_unitaire).toLocaleString()}</td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          value={item.quantite_panier}
                          min="1"
                          onChange={(e) => changerQuantitePanier(item.id_produit, e.target.value, item.stock_total)}
                        />
                      </td>
                      <td className="fw-bold">
                        {(parseFloat(item.prix_vente_unitaire) * item.quantite_panier).toLocaleString()}
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => supprimerDuPanier(item.id_produit)}>
                          ❌
                        </button>
                      </td>
                    </tr>
                  ))}
                  {panier.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-4">
                        Le panier est vide. Scannez ou recherchez un produit pour commencer.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Colonne de droite : Total et Encaissement */}
        <div className="col-md-4 mb-4">
          <div className="card p-3 shadow-sm bg-dark text-white h-100 d-flex flex-column justify-content-between">
            <div>
              <h5 className="fw-bold text-uppercase text-muted border-bottom pb-2">Résumé Vente</h5>
              <div className="my-4 text-center">
                <span className="text-muted d-block small">TOTAL À PAYER</span>
                <span className="display-5 fw-bold text-warning">{totalGeneral.toLocaleString()}</span>
                <span className="ms-2 text-warning fw-bold">FCFA</span>
              </div>

              <div className="mb-4">
                <label className="form-label small fw-bold text-muted">Mode de Règlement</label>
                <select className="form-select bg-secondary text-white border-0" value={modePaiement} onChange={(e) => setModePaiement(e.target.value)}>
                  <option value="ESPECES">💵 Espèces</option>
                  <option value="MOBILE_MONEY">📱 Mobile Money</option>
                  <option value="CARTE">💳 Carte Bancaire</option>
                  <option value="CHEQUE">✍️ Chèque</option>
                  
                  {/* --- SECTION DES ABONNEMENTS RAJOUTÉE ICI --- */}
                  <optgroup label="🔒 Abonnements">
                    {abonnements.map((sub) => (
                      <option key={sub.id_abonnement} value={`ABONNEMENT_${sub.id_abonnement}`}>
                        👤 {sub.nom} ({sub.telephone || "Pas de tél"})
                      </option>
                    ))}
                    {abonnements.length === 0 && (
                      <option disabled>Aucun abonné actif</option>
                    )}
                  </optgroup>
                </select>
              </div>
            </div>

            <button
              onClick={validerVente}
              disabled={panier.length === 0}
              className="btn btn-warning btn-lg w-100 fw-bold mt-3 py-3 text-uppercase shadow"
            >
              🚀 Valider l'encaissement
            </button>
          </div>
        </div>
      </div>

      {/* --- SECTION : HISTORIQUE DES VENTES --- */}
      <div className="row mt-2 no-print">
        <div className="col-12">
          <div className="card p-3 shadow-sm">
            <h5 className="card-title fw-bold text-secondary mb-3">📋 Ventes Récentes &amp; Impression Factures</h5>
            <div className="table-responsive" style={{ maxHeight: "250px" }}>
              <table className="table table-sm table-hover border align-middle mb-0">
                <thead className="table-secondary sticky-top">
                  <tr>
                    <th>Date / Heure</th>
                    <th>Réf Vente</th>
                    <th>Mode</th>
                    <th>Total</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ventesRecentes.map((v) => (
                    <tr key={v.id_vente}>
                      <td>{v.date_vente ? new Date(v.date_vente).toLocaleString() : new Date().toLocaleDateString()}</td>
                      <td className="small fw-bold text-uppercase">{v.id_vente ? `${v.id_vente.substring(0, 8)}...` : "---"}</td>
                      <td><span className="badge bg-light text-dark border">{v.mode_paiement}</span></td>
                      <td className="fw-bold text-primary">{parseFloat(v.total_somme || v.total || 0).toLocaleString()} FCFA</td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-dark fw-bold" onClick={() => handleOuvrirFacture(v)}>
                          🖨️ Facture
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ventesRecentes.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted py-3">Aucune vente enregistrée pour le moment.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODALE BOOTSTRAP : VISU ET EN-TETE DE LA FACTURE --- */}
      <div className="modal fade" id="factureModal" tabIndex="-1" aria-labelledby="factureModalLabel" aria-hidden="true">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header no-print-btn">
              <h5 className="modal-title fw-bold" id="factureModalLabel">📄 Aperçu Facture</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            
            <div className="modal-body modal-print-content">
              {venteSelectionnee ? (
                <div className="p-2 text-dark">
                  {/* EN-TETE DE LA FACTURE ADAPTÉ AVEC LES INFOS DU LOCALSTORAGE */}
                  <div className="text-center border-bottom pb-3 mb-3">
                    {Logo && <img src={Logo} style={{ width: "55px" }} alt="Logo Structure" className="mb-2" />}
                    
                    <h5 className="fw-bold text-uppercase mb-1">
                      {structureInfo?.nom || "PHARMACIE DE LA STRUCTURE"}
                    </h5>
                    
                    {structureInfo?.raison_sociale && (
                      <p className="small text-muted mb-0 fw-semibold">{structureInfo.raison_sociale}</p>
                    )}
                    
                    <p className="small text-muted mb-0">
                      {structureInfo?.adresse || "Gestion de Stock & Point de Vente Unifié"}
                    </p>
                    
                    <p className="small text-muted mb-0">
                      Tél: {structureInfo?.telephone || "(+242) XX XXX XX XX"}
                    </p>
                  </div>

                  {/* DETAILS DE LA VENTE */}
                  <div className="row small mb-3">
                    <div className="col-7">
                      <strong>Facture N°:</strong> <span className="text-uppercase">{venteSelectionnee.id_vente?.substring(0, 13)}</span><br />
                      <strong>Date:</strong> {venteSelectionnee.date_vente ? new Date(venteSelectionnee.date_vente).toLocaleString() : new Date().toLocaleString()}<br />
                    </div>
                    <div className="col-5 text-end">
                      <strong>Règlement:</strong> {venteSelectionnee.mode_paiement}<br />
                      <strong>Opérateur:</strong> {currentUser?.nom_utilisateur || currentUser?.nom || "Caissier"}
                    </div>
                  </div>

                  {/* CORPS DE LA FACTURE */}
                  <table className="table table-sm table-bordered align-middle small mb-3">
                    <thead className="table-light">
                      <tr>
                        <th>Médicament</th>
                        <th className="text-center">Qté</th>
                        <th className="text-end">P.U</th>
                        <th className="text-end">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venteSelectionnee.items?.map((item, idx) => (
                        <tr key={item.id_detail_vente || idx}>
                          <td className="fw-bold">
                            {item.nom_produit || "Médicament"} 
                            {item.numero_lot && <span className="d-block text-muted style-small" style={{fontSize: '10px'}}>Lot: {item.numero_lot}</span>}
                          </td>
                          <td className="text-center">{item.quantite}</td>
                          <td className="text-end">{parseFloat(item.prix_unitaire_vendu).toLocaleString()}</td>
                          <td className="text-end fw-bold">
                            {(parseInt(item.quantite, 10) * parseFloat(item.prix_unitaire_vendu)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* NET A PAYER */}
                  <div className="border-top pt-2 text-end">
                    <h5 className="fw-bold">
                      NET À PAYER :{" "}
                      <span className="text-primary">
                        {parseFloat(venteSelectionnee.total_somme || venteSelectionnee.total || venteSelectionnee.items?.reduce((s, i) => s + (i.quantite * i.prix_unitaire_vendu), 0) || 0).toLocaleString()} FCFA
                      </span>
                    </h5>
                  </div>

                  <div className="text-center mt-4 pt-3 border-top small text-muted">
                    <p className="mb-1">Merci pour votre confiance !</p>
                    <p className="small">Les médicaments vendus ne sont ni repris ni échangés.</p>
                  </div>
                </div>
              ) : (
                <p className="text-center text-muted">Chargement de la facture...</p>
              )}
            </div>

            <div className="modal-footer no-print-btn bg-light">
              <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
              <button type="button" className="btn btn-dark fw-bold" onClick={handlePrintFacture}>
                🖨️ Lancer l'impression
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

export default Caisse;