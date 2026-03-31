import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/auth";
import { Form, Button, Card } from "react-bootstrap";

export default function Login() {
  const [nom, setNom] = useState("");
  const [mdp, setMdp] = useState("");
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const user = await login({ nom, mdp });

      // Redirection selon rôle
      if (user.role === "admin") navigate("/admin");
      else if (user.role === "accueil") navigate("/accueil");
      else if (user.role === "medecin") navigate("/medecin");
      else if (user.role === "labo") navigate("/labo");
    } catch {
      alert("Identifiants incorrects");
    }
  };

  return (
    <Card className="p-4 mx-auto mt-5" style={{ width: 350 }}>
      <h4 className="text-center mb-3">Connexion</h4>

      <Form onSubmit={submit}>
        <Form.Control
          placeholder="Nom d'utilisateur"
          className="mb-3"
          onChange={(e) => setNom(e.target.value)}
        />

        <Form.Control
          type="password"
          placeholder="Mot de passe"
          className="mb-3"
          onChange={(e) => setMdp(e.target.value)}
        />

        <Button type="submit" className="w-100">
          Se connecter
        </Button>
      </Form>
    </Card>
  );
}