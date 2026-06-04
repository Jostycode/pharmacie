import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css';

// Vos imports de composants
import AuthentificationUnique from './login1.jsx';
import Login from './login.jsx';
import GestionPharmacie from './gestion.jsx';        // Proprio / Global

// Import du gardien de sécurité
import ProtectedRoute from './ProtectedRoute.jsx';

let router = createBrowserRouter([
  {
    path: "/",
    element: <AuthentificationUnique />,
    // element: <GestionPharmacie />, // Page publique de connexion
  },
  {
    path: "/gestion",
    element: (
      <ProtectedRoute >
        <GestionPharmacie />
      </ProtectedRoute>
    ),
  },

  {
    path: "*",
    element: <Navigate to="/" replace />,
  }
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <Gestion />
//   </StrictMode>,
// )
