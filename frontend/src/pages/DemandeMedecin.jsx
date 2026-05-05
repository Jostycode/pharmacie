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

    const [interpretation, setInterpretation] = useState("");
    const [interpretationTexte, setInterpretationTexte] = useState("Non renseigné");

    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // --- États Formulaire ---
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [medecin, setMedecin] = useState(""); // Sera initialisé par useEffect
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

    // --- CHARGEMENT INITIAL & SESSION ---
    const fetchData = useCallback(async () => {
        try {
            const [resP, resE, resD] = await Promise.all([
                axios.get("http://localhost:3000/api/patient"),
                axios.get("http://localhost:3000/api/examen"),
                axios.get("http://localhost:3000/api/demande_examen1")
            ]);
            setPatients(resP.data);
            setExamensDispo(resE.data);
            setDemandes(resD.data);
        } catch (err) { console.error("Erreur chargement", err); }
    }, []);

    useEffect(() => {
        fetchData();

        // Récupération automatique du médecin connecté (si session existe)
        const savedUser = sessionStorage.getItem("user");
        if (savedUser) {
            const userObj = JSON.parse(savedUser);
            // On remplit le champ médecin par défaut avec le nom de l'utilisateur connecté
            if (userObj.nom) setMedecin(userObj.nom);
        }
    }, [fetchData]);

    const voirDetails = async (demande) => {
        try {
            setDetailDemande(demande);
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
            alert("Résultat validé !");
            setInterpretationTexte("Non renseigné");
            setDetailDemande(null);
            fetchData();
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
        if (!selectedPatient || examensChoisis.length === 0) return alert("Données manquantes (Patient ou Examens)");

        try {
            const data = {
                medecin,
                examens: examensChoisis,
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

            // Reset après succès
            setIsEditing(false);
            setEditingId(null);
            
            // On réinitialise le médecin avec l'utilisateur de la session
            const savedUser = sessionStorage.getItem("user");
            setMedecin(savedUser ? JSON.parse(savedUser).nom : "");

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
        setMedecin(demande.medecin || "");
        setInterpretation(demande.interpretation || "");

        try {
            const res = await axios.get(`http://localhost:3000/api/demande_examen1/lignes/${demande.id_demande}`);
            setExamensChoisis(res.data.map(l => l.id_examen));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) { console.error(err); }
    };

    return (
        <div className="container mt-4 mb-5">
            <style>{`
            @media print {
                .no-print, form, .alert, .btn, .modal-footer { display: none !important; }
                @page { margin: 1cm; }
                .container { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
                table { width: 100% !important; border-collapse: collapse !important; font-size: 12px; }
                th, td { border: 1px solid #000 !important; padding: 8px !important; }
            }
            `}</style>

            {/* EN-TÊTE D'IMPRESSION */}
            <div className="d-none d-print-block mb-4">
                <div className="row align-items-center border-bottom pb-3">
                    <div className="col-4">
                        <h4 className="fw-bold mb-0 text-uppercase">Destiny Express</h4>
                        <p className="small mb-0">Services Médicaux</p>
                    </div>
                    <div className="col-4 text-center">
                        <h2 className="text-uppercase fw-bold">Rapport d'Examen</h2>
                    </div>
                    <div className="col-4 text-end">
                        <p className="mb-0 small">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* --- SECTION FORMULAIRE --- */}
            <div className={`card shadow-sm p-4 border-0 mb-4 ${isEditing ? 'border-start border-warning border-5' : 'bg-light'} no-print`}>
                <h4 className={`mb-4 ${isEditing ? 'text-warning' : 'text-primary'}`}>
                    {isEditing ? `✏️ Modification Demande #${editingId}` : '📑 Nouvelle Demande d\'Analyses'}
                </h4>
                <div className="row">
                    <div className="col-md-6 mb-3 position-relative">
                        <label className="form-label fw-bold">Patient</label>
                        <div className="input-group shadow-sm">
                            <span className="input-group-text bg-white border-end-0">🔍</span>
                            <input
                                type="text"
                                className="form-control border-start-0"
                                placeholder="Nom ou Prénom du patient..."
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
                            {patients
                            // CORRECTION : On filtre pour ne garder que les patients actifs ou NULL
                            .filter(p => p.est_actif !== false) 
                            .filter(p => `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase()))
                            .map(p => (
                                <li 
                                key={p.id_patient} 
                                className="list-group-item list-group-item-action"
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    handlePatientChange(p.id_patient);
                                    setShowPatientList(false);
                                }}
                                >
                                <strong>{p.nom}</strong> {p.prenom} <small className="text-muted">({p.telephone})</small>
                                </li>
                            ))}
                            {/* Ajustement du message "Aucun trouvé" pour prendre en compte le filtre est_actif */}
                            {patients.filter(p => p.est_actif !== false && `${p.nom} ${p.prenom}`.toLowerCase().includes(searchPatient.toLowerCase())).length === 0 && (
                            <li className="list-group-item disabled">Aucun patient actif trouvé</li>
                            )}
                        </ul>
                        )}
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label fw-bold">Médecin / Technicien</label>
                        <input 
                            className="form-control shadow-sm" 
                            value={medecin} 
                            onChange={e => setMedecin(e.target.value)} 
                            placeholder="Nom du signataire" 
                        />
                    </div>
                </div>

                <div className="mt-2">
                    <label className="form-label fw-bold">Motif / Notes cliniques</label>
                    <textarea 
                        className="form-control shadow-sm" 
                        rows="2" 
                        placeholder="Informations complémentaires..."
                        value={interpretation}
                        onChange={(e) => setInterpretation(e.target.value)}
                    ></textarea>
                </div>

                <div className="d-flex gap-2 mt-4">
                    <button className="btn btn-outline-primary fw-bold" data-bs-toggle="modal" data-bs-target="#modalExamen">
                        ➕ Choisir Examens ({examensChoisis.length})
                    </button>
                    <button onClick={enregistrerDemande} className={`btn ${isEditing ? 'btn-warning' : 'btn-success'} px-5 flex-grow-1 fw-bold shadow-sm`}>
                        {isEditing ? 'METTRE À JOUR' : 'ENREGISTRER LA DEMANDE'}
                    </button>
                </div>
            </div>

            {/* --- SECTION LISTE --- */}
            <div className="card shadow-sm p-4 border-0">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h4 className="mb-0 text-secondary">📋 Demandes en cours</h4>
                    <div className="no-print">
                        <button onClick={() => window.print()} className="btn btn-dark btn-sm">🖨️ Imprimer la liste</button>
                    </div>
                </div>
                
                <div className="row g-2 mb-3 align-items-end no-print">
                    <div className="col-md-4">
                        <input 
                            type="text" 
                            className="form-control form-control-sm" 
                            placeholder="Filtrer par patient ou médecin..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <div className="col-md-3">
                        <select className="form-select form-select-sm" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
                            <option value="tous">Toutes les dates</option>
                            <option value="jour">Aujourd'hui</option>
                            <option value="mois">Ce mois-ci</option>
                            <option value="precise">Date spécifique</option>
                        </select>
                    </div>
                    {filterPeriod === "precise" && (
                        <div className="col-md-3">
                            <input type="date" className="form-control form-control-sm" value={specificDate} onChange={e => setSpecificDate(e.target.value)} />
                        </div>
                    )}
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle">
                        <thead className="table-light">
                            <tr>
                                <th>Date & Heure</th>
                                <th>Patient</th>
                                <th>Médecin</th>
                                <th>Statut</th>
                                <th className="text-center no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredDemandes.length > 0 ? filteredDemandes.map(d => (
                                <tr key={d.id_demande}>
                                    <td className="small text-muted">{new Date(d.date_demande).toLocaleString()}</td>
                                    <td className="fw-bold">{d.nom} {d.prenom}</td>
                                    <td>{d.medecin || "—"}</td>
                                    <td>
                                        <span className={`badge rounded-pill ${
                                            d.statut === 'nouveau' ? 'bg-info' : 
                                            d.statut === 'en_attente' ? 'bg-warning text-dark' : 'bg-success'
                                        }`}>
                                            {d.statut}
                                        </span>
                                    </td>
                                    <td className="text-center no-print">
                                        <div className="btn-group">
                                            <button className="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalDetails" onClick={() => voirDetails(d)}>👁️</button>
                                            <button className="btn btn-sm btn-outline-warning" onClick={() => preparerModification(d)}>✏️</button>
                                            <button className="btn btn-sm btn-outline-danger" onClick={() => supprimerDemande(d.id_demande)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" className="text-center py-4 text-muted">Aucune demande trouvée</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODAL : EXAMENS --- */}
            <div className="modal fade" id="modalExamen" tabIndex="-1">
                <div className="modal-dialog">
                    <div className="modal-content border-0 shadow">
                        <div className="modal-header bg-dark text-white">
                            <h5 className="modal-title font-monospace">Catalogue des examens</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body" style={{maxHeight: '400px', overflowY: 'auto'}}>
                            {examensDispo.filter(ex => ex.est_actif !== false).map(ex => (
                                <div key={ex.id_examen} className="d-flex justify-content-between align-items-center border-bottom py-2">
                                    <div>
                                        <div className="fw-bold">{ex.nom_examen}</div>
                                        <small className="text-muted">{ex.categorie}</small>
                                    </div>
                                    <input className="form-check-input" type="checkbox" style={{width: '1.5em', height: '1.5em'}} 
                                        checked={examensChoisis.includes(ex.id_examen)} 
                                        onChange={() => toggleExamen(ex.id_examen)} 
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary w-100 fw-bold" data-bs-dismiss="modal">Valider la sélection ({examensChoisis.length})</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- MODAL : DÉTAILS --- */}
            <div className="modal fade" id="modalDetails" tabIndex="-1">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content border-0 shadow">
                        <div className="modal-header bg-primary text-white">
                            <h5 className="modal-title">📌 Détails Dossier : {detailDemande?.nom}</h5>
                            <button type="button" className="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div className="modal-body">
                            {detailDemande && (
                                <>
                                    <div className="row g-3 mb-4 p-3 bg-light rounded">
                                        <div className="col-6"><strong>Patient:</strong> {detailDemande.nom} {detailDemande.prenom}</div>
                                        <div className="col-6"><strong>Prescripteur:</strong> {detailDemande.medecin}</div>
                                        <div className="col-6"><strong>Date:</strong> {new Date(detailDemande.date_demande).toLocaleString()}</div>
                                    </div>
                                    
                                    <h6 className="fw-bold border-bottom pb-2">🧪 Liste des Analyses</h6>
                                    <div className="list-group list-group-flush mb-4">
                                        {lignesDetail.map((l, i) => (
                                            <div key={i} className="list-group-item d-flex justify-content-between">
                                                <span>{l.nom_examen}</span>
                                                <span className="badge bg-secondary">{l.categorie}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4">
                                        <label className="form-label fw-bold text-success">✍️ Résultats de Laboratoire</label>
                                        <textarea
                                            className="form-control border-success"
                                            rows="5"
                                            value={interpretationTexte}
                                            onChange={(e) => setInterpretationTexte(e.target.value)}
                                            placeholder="Saisir les résultats détaillés ici..."
                                        ></textarea>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer bg-light">
                            <button className="btn btn-success fw-bold px-4" onClick={() => validerEtArchiver(detailDemande.id_demande)} data-bs-dismiss="modal">
                                ✅ VALIDER ET ARCHIVER
                            </button>
                            <button className="btn btn-link text-muted" data-bs-dismiss="modal">Fermer</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DemandeExamen;