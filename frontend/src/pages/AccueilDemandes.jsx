import { useEffect, useState } from "react";
import { Container, Table, Button, Form } from "react-bootstrap";
import axios from "axios";
import socket from "../socket";

export default function AccueilDemandes() {
  const [demandes, setDemandes] = useState([]);
  const [dateFilter, setDateFilter] = useState("");

  const token = localStorage.getItem("token");

  const fetchDemandes = async () => {
    const r = await axios.get("http://localhost:5000/demandes/accueil", {
      headers: { Authorization: `Bearer ${token}` }
    });
    setDemandes(r.data);
  };

  useEffect(() => {
    fetchDemandes();

    socket.on("refresh_demandes", fetchDemandes);

    return () => socket.off("refresh_demandes");
  }, []);

  const envoyerLabo = async (id) => {
    await axios.put(
      `http://localhost:5000/demandes/envoyer/${id}`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    socket.emit("maj_labo");
  };

  const filtered = demandes.filter(d =>
    dateFilter
      ? new Date(d.date_demande).toISOString().slice(0, 10) === dateFilter
      : true
  );

  return (
    <Container className="mt-4">
      <h3>Demandes Accueil</h3>

      <Form.Control
        type="date"
        className="mb-3"
        onChange={e => setDateFilter(e.target.value)}
      />

      <Table bordered>
        <thead>
          <tr>
            <th>Patient</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(d => (
            <tr key={d.id_demande}>
              <td>{d.nom} {d.prenom}</td>
              <td>{new Date(d.date_demande).toLocaleDateString()}</td>
              <td>
                <Button size="sm" onClick={() => window.print()}>
                  🖨
                </Button>{" "}
                <Button size="sm" onClick={() => envoyerLabo(d.id_demande)}>
                  Envoyer labo
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
}