import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRoles }) {
  const savedUser = sessionStorage.getItem("user");

  // 1. Si aucun utilisateur n'est connecté en mémoire -> Direct au Login
  if (!savedUser) {
    return <Navigate to="/" replace />;
  }

  const user = JSON.parse(savedUser);

  // 2. Vérification stricte du rôle
  // Si la route demande un rôle spécifique (ex: ["Admin"]) et que l'utilisateur n'a pas CE rôle
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Sanction immédiate : On le renvoie au Login et on peut même vider sa session suspecte
    sessionStorage.removeItem("user"); 
    return <Navigate to="/" replace />;
  }

  // 3. Si l'utilisateur est connecté ET qu'il a le bon rôle, on le laisse voir la page
  return children;
}