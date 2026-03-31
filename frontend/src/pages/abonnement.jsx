import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import 'bootstrap/dist/css/bootstrap.min.css';
import socket from '../socket';

function Abonnement() {
    const [data, setData] = useState([]);
    const [nom, setNom] = useState("");
    const [telephone, setTelephone] = useState("");
    const [adresse, setAdresse] = useState("");
    const [editId, setEditId] = useState(null);

    // Utilisation de useCallback pour éviter de recréer la fonction à chaque rendu
    const loadData = useCallback(async () => {
        try {
            const response = await axios.get(`http://localhost:3000/api/abonnement`);
            setData(response.data);
        } catch (error) {
            console.error("Erreur de chargement des données", error);
        }
    }, []);

    useEffect(() => {
        loadData();

        // Ecouter les mises à jour en temps réel
        socket.on('abonnement_updated', loadData);

        return () => {
            socket.off('abonnement_updated', loadData);
        };
    }, [loadData]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nom || !telephone || !adresse) {
            alert("Veuillez remplir tous les champs");
            return;
        }

        // Attention : vérifie que ton backend attend bien "poste" et non "telephone"
        const formData = { nom, adresse, telephone };

        try {
            if (editId) {
                await axios.put(`http://localhost:3000/api/abonnement/${editId}`, formData);
            } else {
                // Correction de l'URL pour correspondre à tes routes habituelles
                await axios.post(`http://localhost:3000/api/abonnement/post`, formData);
            }
            
            // Réinitialisation du formulaire
            setNom("");
            setTelephone("");
            setAdresse("");
            setEditId(null);
            loadData();
        } catch (error) {
            console.error("Erreur lors de l'ajout/modification", error);
        }
    };

    const handleDelete = async (id_abonnement) => {
        if (window.confirm("Voulez-vous vraiment supprimer cet abonnement ?")) {
            try {
                await axios.delete(`http://localhost:3000/api/abonnement/${id_abonnement}`);
                loadData();
            } catch (error) {
                console.error("Erreur lors de la suppression", error);
            }
        }
    };

    const handleEdit = (a) => {
        setNom(a.nom);
        setAdresse(a.adresse);
        setTelephone(a.telephone); 
        setEditId(a.id_abonnement);
    };

    return (
        <div className="commentaire">
            <div className="container pt-5">
                <h2 className="text-center mb-4">Inscription</h2>
                <div className="row"> {/* Utilisation de row pour une meilleure structure Bootstrap */}
                    <div className="col-md-4">
                        <div className="card p-4 shadow-sm">
                            <form onSubmit={handleSubmit}>
                                <div className="mb-3">
                                    <label className="form-label">Nom</label>
                                    <input type="text" className="form-control" value={nom} onChange={(e) => setNom(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Telephone</label>
                                    <input type="text" className="form-control" value={telephone} onChange={(e) => setTelephone(e.target.value)}  />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Adresse</label>
                                    <input type="text" className="form-control" value={adresse} onChange={(e) => setAdresse(e.target.value)}  />
                                </div>
                                <button className="btn btn-primary w-100" type="submit">
                                    {editId ? "Enregistrer les modifications" : "S'inscrire"}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="col-md-8">
                        <h3 className="mb-3" style={{ color: '#13da66' }}>Liste des inscrits</h3>
                        <ul className="list-group">
                            {data.map((a) => (
                                <li key={a.id_abonnement} className="list-group-item d-flex justify-content-between align-items-center mb-2 shadow-sm">
                                    <div>
                                        <strong>{a.nom}</strong> <span className="badge bg-info ms-2">{a.telephone || a.telephone}</span>
                                        <div className="text-muted small">adresse: {a.adresse}</div>
                                    </div>
                                    <div>
                                        <button onClick={() => handleEdit(a)} className="btn btn-sm btn-warning me-2">Modifier</button>
                                        <button onClick={() => handleDelete(a.id_abonnement)} className="btn btn-sm btn-danger">Supprimer</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Abonnement;