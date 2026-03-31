import React, { useState } from "react";
import axios from "axios";
import Gestion from "./Gestion"; 
import Inscription from "./inscription";
import PatientsCRUD from "./pages/PatientsCRUD";

function Connexion() {
    // Correction 1 : Initialiser avec une valeur qui correspond exactement aux options du Select
    const [role, setRole] = useState("Accueil"); 
    const [mdp, setMdp] = useState("");
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null); // Réinitialiser l'erreur à chaque tentative
        try {
            const response = await axios.post("http://localhost:3000/api/utilisateur/connexion", { role, mdp });
            if (response.data.success) {
                setIsConnected(true);
            } else {
                setError("Identifiants incorrects");
            }
        } catch (error) {
            setError("Erreur de connexion au serveur");
        }
    };

    // 🎯 Affichage conditionnel corrigé
    if (isConnected) {
        const roleClient = role.toLowerCase();
        
        if (roleClient === "admin") {
            return <Gestion />;
        } else if (roleClient === "medecin") {
            return <PatientsCRUD />;
        } else {
            // Pour Labo, Accueil, etc.
            return <Gestion />;
        }
    }

    return (
        <div className="container-fluid bgd">
            <div className="p-5 forms">
                <h2 className="text-center">Connexion</h2>
                <div className="card p-4 shadow-sm">
                    <form onSubmit={handleSubmit}>
                        {error && <div className="alert alert-danger">{error}</div>}
                        
                        <div className="mb-3">
                            <label htmlFor="role" className="form-label">Rôle</label>
                            <select
                                className="form-select" // Correction classe Bootstrap
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value="Accueil">Accueil</option>
                                <option value="Medecin">Médecin</option>
                                <option value="Labo">Labo</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </div>

                        <div className="mb-3">
                            <label htmlFor="mdp" className="form-label">Mot de passe</label>
                            <input
                                type="password"
                                className="form-control"
                                id="mdp"
                                value={mdp}
                                onChange={(e) => setMdp(e.target.value)}
                                required
                            />
                        </div>
                        {/* W-100 est mieux pour le mobile que W-25 */}
                        <button className="btn btn-primary w-100" type="submit">Se connecter</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Connexion;