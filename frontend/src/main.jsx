import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ReactDOM from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import './index.css'
import App from './App.jsx'
import Inscription from './inscription.jsx'
import Connexion from './Connexion.jsx'
import Gestion from './Gestion.jsx'
import Gestion1 from './gestion_admin.jsx'

let router = createBrowserRouter([
  {
    path: "/",
    element: <Gestion />,
    // loader: loadRootData,
  },
  {
    path: "/gestion_admin",
    element: <Gestion1 />,
    // loader: loadRootData,
  },
  {
    path: "/",
    element: <Gestion />,
    // loader: loadRootData,
  },
  // {
  //   path: "/urgence",
  //   element: <Urgence />,
  // },
  // {
  //   path: "/service",
  //   element: <Service />,
  // },
  // {
  //   path: "/apropos",
  //   element: <Apropos />,
  // },
  // {
  //   path: "/hospitalisation",
  //   element: <Hospitalisation />,
  // },
  // {
  //   path: "/contact",
  //   element: <Contact />,
  // },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <RouterProvider router={router} />
);

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <Gestion />
//   </StrictMode>,
// )
