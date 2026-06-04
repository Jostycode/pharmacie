import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const savedUser = sessionStorage.getItem("user");

  // Si aucun utilisateur n'est connecté -> Retour à l'écran de connexion
  if (!savedUser) {
    return <Navigate to="/" replace />;
  }

  // Si connecté, on laisse passer. L'affichage se gère à l'intérieur du composant.
  return children;
}