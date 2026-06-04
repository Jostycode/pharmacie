import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';

function GestionStructures() {
    // États du CRUD
    const [data, setData] = useState([]);
    const [nom, setNom] = useState("");
    const [raisonSociale, setRaisonSociale] = useState("");
    const [adresse, setAdresse] = useState("");
    const [telephone, setTelephone] = useState("");
    const [mdp, setMdp] = useState("");
    const [editId, setEditId] = useState(null);

    // États du Login Structure
    const [loginNom, setLoginNom] = useState("");
    const [loginMdp, setLoginMdp] = useState("");
    const [currentStructureId, setCurrentStructureId] = useState(localStorage.getItem("id_structure"));

    // Charger la liste des structures
    const loadData = useCallback(async () => {
        try {
            const response = await axios.get(`http://192.168.100.34:3000/api/structure`);
            setData(response.data);
        } catch (error) {
            console.error("Erreur de chargement des structures", error);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Soumission CRUD (Ajout / Modification)
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nom || !raisonSociale) {
            alert("Le nom et la raison sociale sont obligatoires");
            return;
        }

        const formData = { nom, raison_sociale: raisonSociale, adresse, telephone, mdp };

        try {
            if (editId) {
                await axios.put(`http://192.168.100.34:3000/api/structure/${editId}`, formData);
                alert("Structure modifiée !");
            } else {
                if (!mdp) { alert("Le mot de passe est obligatoire à la création"); return; }
                await axios.post(`http://192.168.100.34:3000/api/structure/post`, formData);
                alert("Structure créée !");
            }
            
            // Reset formulaire
            setNom("");
            setRaisonSociale("");
            setAdresse("");
            setTelephone("");
            setMdp("");
            setEditId(null);
            loadData();
        } catch (error) {
            console.error("Erreur lors de l'enregistrement", error);
            alert("Erreur : " + (error.response?.data?.error || error.message));
        }
    };

    // Suppression d'une structure
    const handleDelete = async (id) => {
        if (window.confirm("Voulez-vous vraiment supprimer cette structure ?")) {
            try {
                await axios.delete(`http://192.168.100.34:3000/api/structure/${id}`);
                if (currentStructureId === id) handleLogoutStructure(); // Déconnexion automatique si supprimée
                loadData();
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
                alert("Impossible de supprimer la structure.");
            }
        }
    };

    // Préparation de la modification
    const handleEdit = (s) => {
        setNom(s.nom);
        setRaisonSociale(s.raison_sociale);
        setAdresse(s.adresse || "");
        setTelephone(s.telephone || "");
        setMdp(""); // On laisse vide pour ne pas forcer le changement de mdp
        setEditId(s.id_structure); // Correction ici : id_structure à la place de id
    };

    // Gestion du Login Structure & LocalStorage
    const handleLoginStructure = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`http://192.168.100.34:3000/api/structure/connexion`, {
                nom: loginNom,
                mdp: loginMdp
            });

            if (response.data.success) {
                const uuidStructure = response.data.structureId;
                localStorage.setItem("id_structure", uuidStructure);
                setCurrentStructureId(uuidStructure);
                alert("Structure identifiée et enregistrée en local !");
                setLoginNom("");
                setLoginMdp("");
            }
        } catch (error) {
            alert("Échec d'authentification : " + (error.response?.data?.message || "Erreur serveur"));
        }
    };

    // Déconnexion de la structure
    const handleLogoutStructure = () => {
        localStorage.removeItem("id_structure");
        setCurrentStructureId(null);
        alert("Structure effacée du stockage local.");
    };

    return (
        <div className="container-fluid pt-5 bg-light" style={{ minHeight: "100vh" }}>
            <div className="container">
                <h1 className="text-center mb-5 fw-bold text-primary">Configuration Systèmes & Structures</h1>

                {/* SECTION 1 : ÉTAT DU STOCKAGE LOCAL */}
                <div className="alert alert-info d-flex justify-content-between align-items-center mb-4 shadow-sm">
                    <div>
                        <strong>Statut LocalStorage :</strong> {currentStructureId ? (
                            <span> Active (UUID : <code className="text-danger">{currentStructureId}</code>)</span>
                        ) : (
                            <span className="text-muted"> Aucune structure configurée sur ce navigateur.</span>
                        )}
                    </div>
                    {currentStructureId && (
                        <button onClick={handleLogoutStructure} className="btn btn-sm btn-outline-danger">
                            Réinitialiser le poste (Quitter)
                        </button>
                    )}
                </div>

                <div className="row g-4">
                    {/* SECTION 2 : FORMULAIRES CRUD & CONNEXION */}
                    <div className="col-lg-4">
                        {/* FORMULAIRE CONFIGURATION */}
                        <div className="card p-4 shadow-sm mb-4 border-0">
                            <h3 className="h5 mb-3 text-secondary fw-bold">
                                {editId ? "📝 Modifier la Structure" : "➕ Créer une Structure"}
                            </h3>
                            <form onSubmit={handleSubmit}>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Nom Unique</label>
                                    <input type="text" className="form-control form-control-sm" value={nom} onChange={(e) => setNom(e.target.value)} required />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Raison Sociale</label>
                                    <input type="text" className="form-control form-control-sm" value={raisonSociale} onChange={(e) => setRaisonSociale(e.target.value)} required />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Téléphone</label>
                                    <input type="text" className="form-control form-control-sm" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
                                </div>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Adresse</label>
                                    <textarea className="form-control form-control-sm" rows="2" value={adresse} onChange={(e) => setAdresse(e.target.value)}></textarea>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small mb-1">
                                        Mot de passe {editId && <span className="text-muted" style={{fontSize: "0.75rem"}}>(laisser vide pour conserver)</span>}
                                    </label>
                                    <input type="password" className="form-control form-control-sm" value={mdp} onChange={(e) => setMdp(e.target.value)} />
                                </div>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-primary btn-sm flex-grow-1" type="submit">
                                        {editId ? "Sauvegarder" : "Ajouter la structure"}
                                    </button>
                                    {editId && (
                                        <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setEditId(null); setNom(""); setRaisonSociale(""); setAdresse(""); setTelephone(""); setMdp(""); }}>
                                            Annuler
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* FORMULAIRE IDENTIFICATION POSTE */}
                        <div className="card p-4 shadow-sm border-0">
                            <h3 className="h5 mb-3 text-dark fw-bold">🔑 Connexion de ce Navigateur</h3>
                            <form onSubmit={handleLoginStructure}>
                                <div className="mb-2">
                                    <label className="form-label small mb-1">Nom Unique de Structure</label>
                                    <input type="text" className="form-control form-control-sm" value={loginNom} onChange={(e) => setLoginNom(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label small mb-1">Mot de passe</label>
                                    <input type="password" className="form-control form-control-sm" value={loginMdp} onChange={(e) => setLoginMdp(e.target.value)} required />
                                </div>
                                <button className="btn btn-dark btn-sm w-100" type="submit">Identifier ce Terminal</button>
                            </form>
                        </div>
                    </div>

                    {/* SECTION 3 : TABLEAU REGISTRE */}
                    <div className="col-lg-8">
                        <div className="card p-4 shadow-sm border-0">
                            <h3 className="h5 mb-4 fw-bold text-success">Registre des Structures Cliniques</h3>
                            <div className="table-responsive">
                                <table className="table table-hover align-middle">
                                    <thead className="table-light">
                                        <tr style={{ fontSize: "0.85rem" }}>
                                            <th>ID Structure</th>
                                            <th>Nom / Raison</th>
                                            <th>Contact / Adresse</th>
                                            <th>Empreinte Sécurisée (Hash)</th>
                                            <th className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((s) => (
                                            <tr key={s.id_structure} style={{ fontSize: "0.9rem" }}>
                                                <td>
                                                    <code className="text-mutedsmall" style={{ fontSize: "0.75rem" }}>{s.id_structure}</code>
                                                </td>
                                                <td>
                                                    <div className="fw-bold">{s.nom}</div>
                                                    <small className="text-muted">{s.raison_sociale}</small>
                                                </td>
                                                <td>
                                                    <div className="small">{s.telephone || "N/A"}</div>
                                                    <small className="text-muted d-block text-truncate" style={{ maxWidth: "150px" }}>{s.adresse || "Aucune"}</small>
                                                </td>
                                                <td>
                                                    <code className="text-break text-secondary p-1 bg-light rounded border d-block" style={{ fontSize: "0.7rem", maxWidth: "200px" }}>
                                                        {s.mdp ? s.mdp.substring(0, 25) + "..." : "Aucun hash"}
                                                    </code>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group shadow-sm">
                                                        <button onClick={() => handleEdit(s)} className="btn btn-outline-warning btn-sm">Modifier</button>
                                                        <button onClick={() => handleDelete(s.id_structure)} className="btn btn-outline-danger btn-sm">Supprimer</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {data.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="text-center text-muted py-4">Aucune structure enregistrée.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GestionStructures;