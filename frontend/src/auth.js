import axios from "axios";

export const login = async ({ nom, mdp, id_structure }) => {
  const response = await axios.post("http://192.168.100.34:3000/api/utilisateur/connexion", {
    nom,
    mdp,
    id_structure // Requis par ton backend pour initialiser le filtre RLS Postgres
  });
  return response.data; // Renvoie { success: true, message, user }
};