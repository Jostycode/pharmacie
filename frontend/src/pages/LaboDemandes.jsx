import { useEffect, useState } from "react";
import { Container, Table, Button, Modal, Form } from "react-bootstrap";
import axios from "axios";
import socket from "../socket";

export default function LaboDemandes() {
  const [demandes, setDemandes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [examens, setExamens] = useState([]);
  const [dateFilter, setDateFilter] = useState("");

  const token = localStorage.getItem("token");

  const fetchDemandes = async () => {
    const r = await axios.get("http://localhost:5000/labo", {
      headers: { Authorization: `Bearer ${token}` }
    });
    setDemandes(r.data);
  };

  useEffect(() => {
    fetchDemandes();
    socket.on("maj_labo", fetchDemandes);
    return () => socket.off("maj_labo");
  }, []);

  const openModal = async (id) => {
    const r = await axios.get(`http://localhost:5000/labo/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    setExamens(r.data);
    setSelected(id);
  };

  return (
    <Container className="mt-4">
      <h3>Labo</h3>

      <Form.Control
        type="date"
        className="mb-3"
        onChange={e => setDateFilter(e.target.value)}
      />

      <Table bordered>
        <tbody>
          {demandes.map(d => (
            <tr key={d.id_demande}>
              <td>{d.nom} {d.prenom}</td>
              <td>
                <Button onClick={() => openModal(d.id_demande)}>
                  Ouvrir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={!!selected} onHide={() => setSelected(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Examens</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {examens.map(e => (
            <Form.Group key={e.id_ligne}>
              <Form.Label>{e.nom_examen}</Form.Label>
              <Form.Control placeholder="Résultat" />
            </Form.Group>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={() => setSelected(null)}>Fermer</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}