import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "./auth";
import { Form, Button, Card, Alert } from "react-bootstrap";

export default function Login() {
  const [nom, setNom] = useState("");
  const [mdp, setMdp] = useState("");
  const [errorMsg, setErrorMsg] = useState(""); // Remplacement des alert() natives par un état d'erreur graphique
  const navigate = useNavigate();

  // On récupère dynamiquement la structure pour afficher un avertissement si nécessaire
  const currentStructureId = localStorage.getItem("id_structure");

  const submit = async (e) => {
    e.preventDefault();
    setErrorMsg(""); // Réinitialisation de l'erreur à chaque tentative
    
    if (!currentStructureId) {
      setErrorMsg("⚠️ Erreur critique : Veuillez d'abord sélectionner une clinique / structure sur ce terminal.");
      return;
    }

    try {
      const response = await login({ nom, mdp, id_structure: currentStructureId });
      
      if (response.success && response.user) {
        // Stockage de la session utilisateur locale (id_utilisateur, nom_utilisateur, role, id_structure)
        sessionStorage.setItem("user", JSON.stringify(response.user));

        // Redirection vers l'interface globale adaptative
        navigate("/gestion");
      } else {
        setErrorMsg("Une erreur inconnue est survenue lors de l'authentification.");
      }
      
    } catch (error) {
      console.error("Erreur de connexion :", error);
      // Récupération fine du message d'erreur envoyé par le serveur (ex: "Identifiants incorrects...")
      const message = error.response?.data?.message || "Impossible de joindre le serveur ou identifiants invalides.";
      setErrorMsg(message);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "80vh" }}>
      <Card className="p-4 shadow-sm border-0 bg-white" style={{ width: 380, borderRadius: "12px" }}>
        <div className="text-center mb-4">
          <h3 className="fw-bold text-dark mb-1">Connexion Agent</h3>
          <p className="text-muted small">Accès sécurisé à votre espace de travail</p>
        </div>

        {/* Zone de notification des erreurs */}
        {errorMsg && (
          <Alert variant="danger" className="py-2 small text-center mb-3">
            {errorMsg}
          </Alert>
        )}

        {/* Alerte préventive si le poste client n'a pas sélectionné de clinique globale */}
        {!currentStructureId && (
          <Alert variant="warning" className="py-2 small mb-3">
            ⚠️ Aucun terminal de structure détecté. Veuillez lier cette application à une clinique avant de vous connecter.
          </Alert>
        )}

        <Form onSubmit={submit}>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold text-secondary">Nom d'utilisateur</Form.Label>
            <Form.Control
              type="text"
              placeholder="Ex: Jean_Dupont"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              disabled={!currentStructureId}
              className="py-2"
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label className="small fw-semibold text-secondary">Mot de passe</Form.Label>
            <Form.Control
              type="password"
              placeholder="••••••••"
              value={mdp}
              onChange={(e) => setMdp(e.target.value)}
              required
              disabled={!currentStructureId}
              className="py-2"
            />
          </Form.Group>

          <Button 
            type="submit" 
            className="w-100 py-2 fw-bold text-white border-0" 
            style={{ backgroundColor: "#13da66" }}
            disabled={!currentStructureId}
          >
            Se connecter
          </Button>
        </Form>
      </Card>
    </div>
  );
}