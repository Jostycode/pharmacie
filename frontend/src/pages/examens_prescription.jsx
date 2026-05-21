import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";

// Liste des catégories standards pour éviter les erreurs de saisie
const CATEGORIES_STANDARDS = [
    "Biochimie", "Biologie", "Imagerie", "Cardiologie", 
    "Hormonologie", "Microbiologie", "Parasitologie", "Fonctionnel"
];

function ExamenPrescription() {
    const [examens, setExamens] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    
    // États du formulaire
    const [nom, setNom] = useState("");
    const [categorie, setCategorie] = useState(CATEGORIES_STANDARDS[0]);
    
    // État d'édition
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Charger les examens depuis le back
    const chargerCatalogue = useCallback(async () => {
        try {
            const res = await axios.get(`http://localhost:3000/api/prescription/examens-catalogue?search=${searchTerm}`);
            setExamens(res.data);
        } catch (err) {
            console.error("Erreur chargement catalogue", err);
            alert("probleme de connexion internet");
        }
    }, [searchTerm]);

    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            chargerCatalogue();
        }, 300);
        return () => clearTimeout(delayDebounce);
    }, [searchTerm, chargerCatalogue]);

    // Soumettre le formulaire (Ajout ou Modification)
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!nom.trim() || !categorie) return alert("Veuillez remplir tous les champs");

        try {
            if (isEditing) {
                await axios.put(`http://localhost:3000/api/prescription/examens-catalogue/${editingId}`, { nom, categorie });
                alert("Examen mis à jour !");
            } else {
                await axios.post("http://localhost:3000/api/prescription/examens-catalogue/post", { nom, categorie });
                alert("Nouvel examen ajouté au catalogue mondial !");
            }
            
            // Réinitialisation
            setNom("");
            setCategorie(CATEGORIES_STANDARDS[0]);
            setIsEditing(false);
            setEditingId(null);
            chargerCatalogue();
        } catch (err) {
            alert("Erreur lors de l'enregistrement de l'examen");
        }
    };

    // Préparer le mode édition
    const preparerModification = (examen) => {
        setIsEditing(true);
        setEditingId(examen.id_examen_univ);
        setNom(examen.nom);
        setCategorie(examen.categorie);
    };

    // Supprimer un examen
    const supprimerExamen = async (id) => {
        if (window.confirm("Voulez-vous vraiment retirer cet examen du catalogue ?")) {
            try {
                await axios.delete(`http://localhost:3000/api/prescription/examens-catalogue/${id}`);
                chargerCatalogue();
            } catch (err) {
                // Capturer le message d'erreur si l'examen est lié à une prescription historique
                alert(err.response?.data?.error || "Erreur lors de la suppression");
            }
        }
    };

    return (
        <div className="container mt-4">
            <div className="row">
                {/* FORMULAIRE (AJOUT / EDITION) */}
                <div className="col-md-4 mb-4">
                    <div className={`card shadow-sm p-4 border-0 ${isEditing ? 'border-top border-warning border-4' : 'border-top border-primary border-4'}`}>
                        <h5 className="mb-3 fw-bold">{isEditing ? "✏️ Modifier l'examen" : "➕ Ajouter un examen"}</h5>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="form-label small fw-bold">Nom de l'examen</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Ex: Glycémie post-prandiale"
                                    value={nom} 
                                    onChange={(e) => setNom(e.target.value)}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="form-label small fw-bold">Catégorie</label>
                                <select 
                                    className="form-select" 
                                    value={categorie} 
                                    onChange={(e) => setCategorie(e.target.value)}
                                >
                                    {CATEGORIES_STANDARDS.map((cat, idx) => (
                                        <option key={idx} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="d-grid gap-2">
                                <button type="submit" className={`btn ${isEditing ? 'btn-warning text-white' : 'btn-primary'} fw-bold`}>
                                    {isEditing ? "Mettre à jour" : "Ajouter au catalogue"}
                                </button>
                                {isEditing && (
                                    <button 
                                        type="button" 
                                        className="btn btn-link btn-sm text-secondary" 
                                        onClick={() => {
                                            setIsEditing(false);
                                            setNom("");
                                            setEditingId(null);
                                        }}
                                    >
                                        Annuler la modification
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* TABLEAU ET FILTRE DE RECHERCHE */}
                <div className="col-md-8">
                    <div className="card shadow-sm p-4 border-0">
                        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                            <h5 className="fw-bold mb-0 text-secondary">📋 Catalogue des Examens Disponibles ({examens.length})</h5>
                            <div className="input-group" style={{ maxWidth: '250px' }}>
                                <span className="input-group-text bg-white border-end-0">🔍</span>
                                <input 
                                    type="text" 
                                    className="form-control border-start-0" 
                                    placeholder="Filtrer la liste..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="table-responsive" style={{ maxHeight: '450px', overflowY: 'auto' }}>
                            <table className="table table-hover align-middle">
                                <thead className="table-light sticky-top" style={{ zIndex: 1 }}>
                                    <tr>
                                        <th>Nom de l'examen</th>
                                        <th>Catégorie</th>
                                        <th className="text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {examens.length > 0 ? examens.map((ex) => (
                                        <tr key={ex.id_examen_univ}>
                                            <td className="fw-semibold text-dark">{ex.nom}</td>
                                            <td>
                                                <span className="badge bg-light text-dark border">{ex.categorie}</span>
                                            </td>
                                            <td className="text-center">
                                                <div className="btn-group">
                                                    <button 
                                                        className="btn btn-sm btn-outline-warning" 
                                                        onClick={() => preparerModification(ex)}
                                                        title="Modifier"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        className="btn btn-sm btn-outline-danger" 
                                                        onClick={() => supprimerExamen(ex.id_examen_univ)}
                                                        title="Supprimer"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="3" className="text-center py-4 text-muted small">
                                                Aucun examen trouvé dans le catalogue.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ExamenPrescription;