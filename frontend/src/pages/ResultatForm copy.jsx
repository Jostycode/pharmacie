import { useState } from "react";
import { Table, Form, Button } from "react-bootstrap";
import axios from "axios";
import socket from "../socket";

export default function ResultatForm({ examens, idDemande, onClose }) {
  const token = localStorage.getItem("token");

  const [resultats, setResultats] = useState({});

  const handleSimpleChange = (id_ligne, value) => {
    setResultats(prev => ({
      ...prev,
      [id_ligne]: [
        {
          nom: "Résultat",
          valeur: value,
          unite: "",
          norme: "",
          interpretation: ""
        }
      ]
    }));
  };

  const handleParamChange = (id_ligne, index, field, value) => {
    setResultats(prev => {
      const lignes = prev[id_ligne] || [];
      lignes[index] = { ...lignes[index], [field]: value };
      return { ...prev, [id_ligne]: lignes };
    });
  };

  const addParamRow = (id_ligne) => {
    setResultats(prev => ({
      ...prev,
      [id_ligne]: [
        ...(prev[id_ligne] || []),
        { nom: "", valeur: "", unite: "", norme: "", interpretation: "" }
      ]
    }));
  };

  const enregistrer = async () => {
    for (let id_ligne in resultats) {
      await axios.post(
        "http://localhost:5000/labo/resultat",
        {
          id_ligne,
          valeurs: resultats[id_ligne]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    }

    await axios.put(
      `http://localhost:5000/labo/terminer/${idDemande}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    socket.emit("maj_labo");
    alert("Résultats enregistrés");
    onClose();
  };

  return (
    <>
      {examens.map(ex => (
        <div key={ex.id_ligne} className="mb-4 p-3 border rounded">

          <h5>{ex.nom_examen}</h5>

          {ex.type_resultat === "simple" ? (
            <Form.Control
              placeholder="Entrer résultat"
              onChange={(e) =>
                handleSimpleChange(ex.id_ligne, e.target.value)
              }
            />
          ) : (
            <>
              <Table bordered size="sm">
                <thead>
                  <tr>
                    <th>Paramètre</th>
                    <th>Valeur</th>
                    <th>Unité</th>
                    <th>Norme</th>
                    <th>Interprétation</th>
                  </tr>
                </thead>
                <tbody>
                  {(resultats[ex.id_ligne] || []).map((row, i) => (
                    <tr key={i}>
                      <td>
                        <Form.Control
                          onChange={(e) =>
                            handleParamChange(ex.id_ligne, i, "nom", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          onChange={(e) =>
                            handleParamChange(ex.id_ligne, i, "valeur", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          onChange={(e) =>
                            handleParamChange(ex.id_ligne, i, "unite", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          onChange={(e) =>
                            handleParamChange(ex.id_ligne, i, "norme", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          onChange={(e) =>
                            handleParamChange(ex.id_ligne, i, "interpretation", e.target.value)
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <Button
                size="sm"
                onClick={() => addParamRow(ex.id_ligne)}
              >
                + Ajouter paramètre
              </Button>
            </>
          )}
        </div>
      ))}

      <Button variant="success" onClick={enregistrer}>
        Valider tous les résultats
      </Button>
    </>
  );
}