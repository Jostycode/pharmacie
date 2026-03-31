import React, { useEffect, useState, useCallback, useMemo } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

function DemandeExamen() {
    const [patients, setPatients] = useState([]);
    const [examensDispo, setExamensDispo] = useState([]);
    const [demandes, setDemandes] = useState([]);
    const [searchPatient, setSearchPatient] = useState("");
    const [showPatientList, setShowPatientList] = useState(false);

    // Dans vos états en haut du composant
    const [interpretation, setInterpretation] = useState("");

    // Initialisé avec la valeur par défaut de votre BD
    const [interpretationTexte, setInterpretationTexte] = useState("Non renseigné");

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // --- États Formulaire ---
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [medecin, setMedecin] = useState("");
    const [examensChoisis, setExamensChoisis] = useState([]);
    const [searchExamenModal, setSearchExamenModal] = useState("");
    const [constantes, setConstantes] = useState({
        poids: "", tension: "", temperature: "", age: "", saturation: ""
    });

    // --- État Détails ---
    const [detailDemande, setDetailDemande] = useState(null);
    const [lignesDetail, setLignesDetail] = useState([]);

    // --- États Liste ---
    const [searchTerm, setSearchTerm] = useState("");
    const [filterPeriod, setFilterPeriod] = useState("tous");
    const [sortConfig, setSortConfig] = useState({ key: "date_demande", direction: "desc" });
    const [specificDate, setSpecificDate] = useState("");

    const fetchData = useCallback(async () => {
        try {
            const [resP, resE, resD] = await Promise.all([
                axios.get("http://localhost:3000/api/patient"),
                axios.get("http://localhost:3000/api/examen"),
                // Note: Le backend doit maintenant filtrer par WHERE statut = 'nouveau'
                axios.get("http://localhost:3000/api/demande_examen1")
            ]);
            setPatients(resP.data);
            setExamensDispo(resE.data);
            setDemandes(resD.data);
        } catch (err) { console.error("Erreur chargement", err); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const voirDetails = async (demande) => {
        try {
            setDetailDemande(demande);
            // On réinitialise le texte avec l'interprétation existante ou le défaut
            setInterpretationTexte(demande.interpretation || "Non renseigné");
            const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
            setLignesDetail(res.data);
        } catch (err) { console.error("Erreur détails", err); }
    };

    const validerEtArchiver = async (id_demande) => {
        try {
            await axios.put(`http://localhost:3000/api/demande_examen1/valider/${id_demande}`, {
                interpretation: interpretationTexte
            });
            alert("Résultat validé ! La demande ne s'affichera plus dans la liste active.");
            setInterpretationTexte("Non renseigné");
            setDetailDemande(null);
            fetchData(); // Rafraîchit pour faire disparaître le nom
        } catch (err) {
            alert("Erreur lors de la validation");
        }
    };

    const filteredDemandes = useMemo(() => {
        let result = demandes.filter((d) => {
            const dateD = new Date(d.date_demande);
            const maintenant = new Date();
            let matchDate = true;

            if (filterPeriod === "jour") {
                matchDate = dateD.toDateString() === maintenant.toDateString();
            } else if (filterPeriod === "mois") {
                matchDate = (dateD.getMonth() === maintenant.getMonth() && dateD.getFullYear() === maintenant.getFullYear());
            } else if (filterPeriod === "annee") {
                matchDate = dateD.getFullYear() === maintenant.getFullYear();
            } else if (filterPeriod === "precise" && specificDate) {
                const selectedDate = new Date(specificDate).toDateString();
                matchDate = dateD.toDateString() === selectedDate;
            }

            const searchStr = `${d.nom} ${d.prenom} ${d.medecin}`.toLowerCase();
            return matchDate && searchStr.includes(searchTerm.toLowerCase());
        });

        result.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];
            if (sortConfig.key === "date_demande") { aVal = new Date(aVal); bVal = new Date(bVal); }
            if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });
        return result;
    }, [demandes, searchTerm, filterPeriod, specificDate, sortConfig]);

    const handlePatientChange = (id) => {
        const p = patients.find(pat => String(pat.id_patient) === String(id));
        if (p) {
            setSelectedPatient(p);
            setSearchPatient(`${p.nom} ${p.prenom}`);
            setConstantes({
                poids: p.poids || "", tension: p.tension || "",
                temperature: p.temperature || "", age: p.age || "", saturation: p.saturation || ""
            });
        }
    };

    const toggleExamen = (id) => {
        setExamensChoisis(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const enregistrerDemande = async () => {
  if (!selectedPatient || examensChoisis.length === 0) return alert("Données manquantes");
  
  try {
    const data = { 
      medecin, 
      examens: examensChoisis, // On envoie le tableau d'IDs directement [1, 2, 3]
      interpretation 
    };

    if (isEditing) {
      await axios.put(`http://localhost:3000/api/demande_examen1/update/${editingId}`, data);
    } else {
      await axios.post("http://localhost:3000/api/demande_examen1/post", {
        ...data,
        id_patient: selectedPatient.id_patient,
        constantes
      });
    }
    
    // Reset complet après succès
    setIsEditing(false); // <--- Remis à false pour la prochaine demande
    setEditingId(null);
    setMedecin("");
    setExamensChoisis([]);
    setSelectedPatient(null);
    setSearchPatient("");
    setInterpretation("");
    
    fetchData();
    alert("Enregistrement réussi !");
  } catch (err) { 
    console.error(err);
    alert("Erreur serveur lors de l'enregistrement"); 
  }
};

    const supprimerDemande = async (id) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette demande ?")) {
            try {
                await axios.delete(`http://localhost:3000/api/demande_examen1/${id}`);
                fetchData();
            } catch (err) { alert("Erreur lors de la suppression"); }
        }
    };

    const preparerModification = async (demande) => {
      setIsEditing(true);
      setEditingId(demande.id_demande);
      
      const p = patients.find(pat => pat.id_patient === demande.id_patient);
      setSelectedPatient(p);
      setMedecin(demande.medecin);
      setInterpretation(demande.interpretation || ""); // <--- Ajouté ici

      try {
        const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
        setExamensChoisis(res.data.map(l => l.id_examen));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) { console.error(err); }
    };

    return (
        <div className="container mt-4 mb-5">
            {/* --- SECTION FORMULAIRE --- */}
            <div className={`card shadow-sm p-4 border-0 mb-4 ${isEditing ? 'border-start border-warning border-5' : 'bg-light'}`}>
                <h4 className={`mb-4 ${isEditing ? 'text-warning' : 'text-primary'}`}>
                    {isEditing ? `✏️ Modification Demande #${editingId}` : '📑 Nouvelle Demande d\'Analyses'}
                </h4>
                <div className="row">
                    <div className="col-md-6 mb-3 position-relative">
                        <label className="form-label fw-bold">Patient</label>
                        <div className="input-group">
                            <span className="input-group-text bg-white border-end-0">🔍</span>
                            <input
                                type="text"
                                className="form-control shadow-sm border-start-0"
                                placeholder="Rechercher un patient..."
                                value={selectedPatient ? `${selectedPatient.nom} ${selectedPatient.prenom}` : searchPatient}
                                onChange={(e) => {
                                    setSearchPatient(e.target.value);
                                    if (selectedPatient) setSelectedPatient(null);
                                    setShowPatientList(true);
                                }}
                                onFocus={() => setShowPatientList(true)}
                            />
                        </div>
                        {showPatientList && !selectedPatient && searchPatient.length > 0 && (
                            <ul className="list-group position-absolute w-100 shadow-lg" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                {patients.filter(p => `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase())).map(p => (
                                    <li key={p.id_patient} className="list-group-item list-group-item-action" style={{ cursor: 'pointer' }}
                                        onClick={() => { handlePatientChange(p.id_patient); setShowPatientList(false); }}>
                                        <strong>{p.nom}</strong> {p.prenom}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label fw-bold">Médecin Prescripteur</label>
                        <input className="form-control shadow-sm" value={medecin} onChange={e => setMedecin(e.target.value)} placeholder="Nom du médecin" />
                    </div>
                </div>
                <div className="mt-3">
                  <label className="form-label fw-bold">Interprétation / Résultats</label>
                  <textarea 
                    className="form-control shadow-sm" 
                    rows="3" 
                    placeholder="Saisir les résultats ou notes ici..."
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                  ></textarea>
                </div>

                <div className="d-flex gap-2 mt-3">
                    <button className="btn btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalExamen">
                        ➕ Choisir Examens ({examensChoisis.length})
                    </button>
                    <button onClick={enregistrerDemande} className={`btn ${isEditing ? 'btn-warning' : 'btn-success'} px-5 flex-grow-1 fw-bold`}>
                        {isEditing ? 'METTRE À JOUR' : 'ENREGISTRER LA DEMANDE'}
                    </button>
                </div>
            </div>

            {/* --- SECTION HISTORIQUE --- */}
            <div className="card shadow-sm p-4">
                <h4 className="mb-4">📋 Demandes en cours (Nouveau)</h4>
                
                <div className="row g-2 mb-3 align-items-end">
                  {/* Recherche textuelle */}
                  <div className="col-md-3">
                    <label className="form-label small fw-bold">Recherche rapide</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Patient, médecin..." 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                    />
                  </div>

                  {/* Sélecteur de type de période */}
                  <div className="col-md-3">
                    <label className="form-label small fw-bold">Période</label>
                    <select className="form-select" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                      <option value="tous">Toutes les périodes</option>
                      <option value="jour">Aujourd'hui</option>
                      <option value="mois">Ce mois-ci</option>
                      <option value="precise">Date précise 📅</option>
                    </select>
                  </div>

                  {/* Champ Date précise (Affiche seulement si "Date précise" est sélectionné) */}
                  {filterPeriod === "precise" && (
                    <div className="col-md-3 animate__animated animate__fadeIn">
                      <label className="form-label small fw-bold">Choisir le jour</label>
                      <input 
                        type="date" 
                        className="form-control border-primary" 
                        value={specificDate} 
                        onChange={e => setSpecificDate(e.target.value)} 
                      />
                    </div>
                  )}

                  <div className="col-md-3 ms-auto text-end">
                    <button onClick={() => window.print()} className="btn btn-dark w-100">🖨️ Imprimer</button>
                  </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle border">
                        <thead className="table-dark">
                            <tr>
                                <th>Date</th>
                                <th>Patient</th>
                                <th>Médecin</th>
                                <th>Statut</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDemandes.map(d => (
                                <tr key={d.id_demande}>
                                    <td className="small">{new Date(d.date_demande).toLocaleString()}</td>
                                    <td className="fw-bold">{d.nom} {d.prenom}</td>
                                    <td>{d.medecin || "N/A"}</td>
                                    <td>
                                        <span className={`badge ${
                                            d.statut === 'nouveau' ? 'bg-info' : 
                                            d.statut === 'en_attente' ? 'bg-warning text-dark' : 'bg-success'
                                        }`}>
                                            {d.statut === 'en_attente' ? '⏳ En attente' : d.statut}
                                        </span>
                                    </td>
                                    <td className="text-center">
                                        <div className="btn-group">
                                            <button className="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#modalDetails" onClick={() => voirDetails(d)}>👁️</button>
                                            <button className="btn btn-sm btn-warning" onClick={() => preparerModification(d)}>✏️</button>
                                            <button className="btn btn-sm btn-danger" onClick={() => supprimerDemande(d.id_demande)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL : SÉLECTION EXAMENS --- */}
            <div className="modal fade" id="modalExamen" tabIndex="-1">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header bg-dark text-white">
                            <h5 className="modal-title">Catalogue des examens</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            {examensDispo.map(ex => (
                                <div key={ex.id_examen} className="d-flex justify-content-between border-bottom py-2">
                                    <label>{ex.nom_examen}</label>
                                    <input className="form-check-input" type="checkbox" checked={examensChoisis.includes(ex.id_examen)} onChange={() => toggleExamen(ex.id_examen)} />
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer"><button className="btn btn-primary w-100" data-bs-dismiss="modal">Terminer</button></div>
                    </div>
                </div>
            </div>

            {/* --- MODAL : DÉTAILS ET INTERPRÉTATION --- */}
            <div className="modal fade" id="modalDetails" tabIndex="-1">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title">📌 Dossier Patient : {detailDemande?.nom}</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            {detailDemande && (
                                <>
                                    <div className="row mb-3">
                                        <div className="col-md-6"><strong>Patient:</strong> {detailDemande.nom} {detailDemande.prenom}</div>
                                        <div className="col-md-6"><strong>Médecin:</strong> {detailDemande.medecin}</div>
                                    </div>
                                    <h6 className="fw-bold border-bottom pb-2">🧪 Examens à réaliser</h6>
                                    <ul className="list-group list-group-flush mb-4">
                                        {lignesDetail.map((l, i) => (
                                            <li key={i} className="list-group-item">✅ {l.nom_examen} ({l.categorie})</li>
                                        ))}
                                    </ul>

                                    <div className="mt-4 p-3 border rounded bg-light">
                                        <label className="form-label fw-bold text-primary">✍️ Interprétation & Résultats</label>
                                        <textarea
                                            className="form-control"
                                            rows="4"
                                            value={interpretationTexte}
                                            onChange={(e) => setInterpretationTexte(e.target.value)}
                                        ></textarea>
                                        <small className="text-muted">La validation changera le statut en "validé".</small>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-success fw-bold" onClick={() => validerEtArchiver(detailDemande.id_demande)} data-bs-dismiss="modal">
                                ✅ VALIDER LES RÉSULTATS
                            </button>
                            <button className="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DemandeExamen;