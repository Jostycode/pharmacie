import React, { useState } from "react";
import PatientsCRUD from "./pages/patientsCRUD";
import ExamenCRUD from "./pages/examensCRUD";
import Consultation from "./pages/consultation";
import DemandeMedecin from "./pages/DemandeMedecin";
import LaboDemandes from "./pages/LaboDemandes";
import Dashboard from "./pages/dashboard";
import Abonnement from "./pages/abonnement";
import Inscription from "./inscription";
import Parameteur from "./pages/parameteur";
import DemandeExamen from "./pages/DemandeExamen";
import DemandeExamen1 from "./pages/DemandeExamen1";
import ResultatExamen from "./pages/Resultat";
import ListeResultatsGroupes from "./pages/consultationResultats";
import Caisse from "./pages/caisse";

function Gestion1() {
  const [activePage, setActivePage] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return <Dashboard />;
      case "utilisateurs":
        return <Inscription />;
      case "consultation":
        return <Consultation />;
      case "patients":
        return <PatientsCRUD />;
      case "parameteur":
        return <Parameteur />;
      case "examens":
        return <ExamenCRUD />;
      case "demande_medecin":
        return <DemandeMedecin />;
      case "demande_examen1":
        return <DemandeExamen1 />
      case " demande_labo":
        return <LaboDemandes />;
      case "resultats":
        return <ResultatExamen />;
      case "consultationResultats":
        return <ListeResultatsGroupes />;
      case "abonnement":
        return <Abonnement />;
      case "caisse":
        return <Caisse />;
      default:
        return <h2>Dashboard labo</h2>;
    }
  };

  return (
    <div className="d-flex">
      <button
        className="btn btn-primary d-md-none m-2 no-print"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        ☰
      </button>

      <div
        className={`bg-dark text-white p-3 vh-100 ${
          isSidebarOpen ? "d-block" : "d-none"
        } d-md-block no-print`}
        style={{ width: "250px" }}
      >
        <h4 className="text-center mb-3">Medsoft</h4>

        <ul className="nav flex-column">
          <li>
            <button
              onClick={() => setActivePage("dashboard")}
              className="nav-link text-white btn btn-link"
            >
              Dashboard
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("patients")}
              className="nav-link text-white btn btn-link"
            >
              Patients
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("examens")}
              className="nav-link text-white btn btn-link"
            >
              Examens
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("parameteur")}
              className="nav-link text-white btn btn-link"
            >
              parameteur
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("demande_medecin")}
              className="nav-link text-white btn btn-link"
            >
              demande medecin
            </button>
          </li>
          <li>
            <button
              onClick={() => setActivePage("demande_examen1")}
              className="nav-link text-white btn btn-link"
            >
              demande examen
            </button>
          </li>
          <li>
            <button
              onClick={() => setActivePage("resultats")}
              className="nav-link text-white btn btn-link"
            >
              Résultats
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("consultation")}
              className="nav-link text-white btn btn-link"
            >
              consultation
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("consultationResultats")}
              className="nav-link text-white btn btn-link"
            >
              Liste resultat
            </button>
          </li>

          <li>
            <button
              onClick={() => setActivePage("utilisateurs")}
              className="nav-link text-white btn btn-link"
            >
              Utilisateurs
            </button>
          </li>
          <li>
            <button
              onClick={() => setActivePage("abonnement")}
              className="nav-link text-white btn btn-link"
            >
              Abonnement
            </button>
          </li>
          <li>
            <button
              onClick={() => setActivePage("caisse")}
              className="nav-link text-white btn btn-link"
            >
              Caisse
            </button>
          </li>
        </ul>
      </div>

      <div className="p-3 flex-grow-1">{renderContent()}</div>
    </div>
  );
}

export default Gestion1;
