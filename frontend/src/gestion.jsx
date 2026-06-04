import React, { useState } from "react";

// --- IMPORTS DES COMPOSANTS PHARMACIE ---
import Dashboard from "./pages/dashboard"; 
import ProduitsEtStock from "./pages/Produits"; 
import Caisse from "./pages/caisse"; 
import LotsStock from "./pages/lotStock"; 

// --- IMPORTS CONFIGURATION & AUTHENTIFICATION ---
import Inscription from "./inscription";
import Login from "./login";
import AuthentificationUnique from "./login1";
import GestionStructures from "./structures";

function GestionPharmacie() {
  const [activePage, setActivePage] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Rôles disponibles pour tester le filtrage : "admin", "pharmacien", "caisse"
  const [userRole, setUserRole] = useState("admin"); 

  const [openMenus, setOpenMenus] = useState({
    officine: true,
    administration: false,
  });

  const toggleMenu = (menuKey) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
  };

  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard />;
      case "caisse":
        return <Caisse />;
      case "lots":
        return ["admin", "pharmacien"].includes(userRole) ? <LotsStock /> : <Dashboard />;
      case "produits":
        return ["admin", "pharmacien"].includes(userRole) ? <ProduitsEtStock /> : <Dashboard />;
      case "utilisateurs":
        return userRole === "admin" ? <Inscription /> : <Dashboard />;
      case "structures":
        return userRole === "admin" ? <GestionStructures /> : <Dashboard />;
      case "login":
        return <Login />;
      case "login1":
        return <AuthentificationUnique />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="d-flex">
      {/* Bouton pour petits écrans */}
      <button
        className="btn btn-primary d-md-none m-2 no-print"
        style={{ position: "absolute", zIndex: 1050 }}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        ☰
      </button>

      {/* Barre de navigation latérale */}
      <div
        className={`sticky-top bg-dark text-white p-3 vh-100 ${
          isSidebarOpen ? "d-block" : "d-none"
        } d-md-block no-print`}
        style={{ width: "260px", overflowY: "auto", boxShadow: "4px 0 10px rgba(0,0,0,0.15)" }}
      >
        <h4 className="text-center mb-4 fw-bold text-success border-bottom pb-3">PHARMA-MEDSOFT</h4>

        {/* Sélecteur de rôle rapide pour vos tests de développement */}
        <div className="mb-3 text-center">
          <span className="badge bg-secondary p-2">Rôle : {userRole.toUpperCase()}</span>
        </div>

        <ul className="nav flex-column gap-1">
          {/* Vue d'ensemble - Accessible par tous */}
          <li className="nav-item">
            <button
              onClick={() => setActivePage("dashboard")}
              className={`nav-link w-100 text-start text-white btn border-0 py-2 d-flex align-items-center gap-2 ${
                activePage === "dashboard" ? "bg-success fw-bold rounded" : ""
              }`}
            >
              📊 <span>Tableau de bord</span>
            </button>
          </li>

          {/* SECTION 1 : GESTION PHARMACIE */}
          <li className="nav-item mt-2">
            <button
              onClick={() => toggleMenu("officine")}
              className="nav-link w-100 text-start text-white btn border-0 d-flex justify-content-between align-items-center py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "4px" }}
            >
              <span className="fw-bold text-success">🟢 Activité Pharmacie</span>
              <small>{openMenus.officine ? "▲" : "▼"}</small>
            </button>
            
            {openMenus.officine && (
              <ul className="nav flex-column ms-2 my-1 ps-2 border-start border-success gap-1">
                {/* Toujours visible pour tout le monde (Caisse, Pharmacien, Admin) */}
                <li>
                  <button
                    onClick={() => setActivePage("caisse")}
                    className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "caisse" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                  >
                    🛒 Comptoir de Vente (Caisse)
                  </button>
                </li>
                
                {/* Filtré : Uniquement Admin et Pharmacien */}
                {["admin", "pharmacien"].includes(userRole) && (
                  <>
                    {/* <li>
                      <button
                        onClick={() => setActivePage("lots")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "lots" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                      >
                        📦 Arrivages & Périssables
                      </button>
                    </li> */}
                    <li>
                      <button
                        onClick={() => setActivePage("produits")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-2 ${activePage === "produits" ? "text-success fw-bold bg-secondary bg-opacity-25" : ""}`}
                      >
                        💊 Catalogue Médicaments
                      </button>
                    </li>
                  </>
                )}
              </ul>
            )}
          </li>

          {/* SECTION 2 : CONFIGURATION & ADMINISTRATION */}
          <li className="nav-item mt-1">
            <button
              onClick={() => toggleMenu("administration")}
              className="nav-link w-100 text-start text-white btn border-0 d-flex justify-content-between align-items-center py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: "4px" }}
            >
              <span>⚙️ Paramètres & Sessions</span>
              <small>{openMenus.administration ? "▲" : "▼"}</small>
            </button>
            
            {openMenus.administration && (
              <ul className="nav flex-column ms-2 my-1 ps-2 border-start border-secondary gap-1">
                {/* Filtré : Liens uniquement visibles pour l'Administrateur */}
                {userRole === "admin" && (
                  <>
                    <li>
                      <button
                        onClick={() => setActivePage("utilisateurs")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "utilisateurs" ? "text-success fw-bold" : ""}`}
                      >
                        • Enrôler du Personnel (Admin)
                      </button>
                    </li>
                    {/* <li>
                      <button
                        onClick={() => setActivePage("structures")}
                        className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "structures" ? "text-success fw-bold" : ""}`}
                      >
                        • Multi-Établissements (Admin)
                      </button>
                    </li> */}
                  </>
                )}
                
                {/* Authentification standard accessible par défaut */}
                <li>
                  <button
                    onClick={() => setActivePage("login")}
                    className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "login" ? "text-success fw-bold" : ""}`}
                  >
                    • Connexion Session
                  </button>
                </li>
                {/* <li>
                  <button
                    onClick={() => setActivePage("login1")}
                    className={`nav-link w-100 text-start text-white-50 btn btn-sm border-0 py-1 ${activePage === "login1" ? "text-success fw-bold" : ""}`}
                  >
                    • Portail Unique (SSO)
                  </button>
                </li> */}
              </ul>
            )}
          </li>
        </ul>
      </div>

      {/* Zone d'affichage du composant actif */}
      <div className="p-4 flex-grow-1" style={{ minHeight: "100vh", backgroundColor: "#f4f6f9" }}>
        {renderContent()}
      </div>
    </div>
  );
}

export default GestionPharmacie;