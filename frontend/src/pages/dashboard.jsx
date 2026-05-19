import React, { useEffect, useState, useCallback, useRef } from "react";
import { Container, Row, Col, Card, Button, Modal, Table, Spinner, Alert, Badge, Form } from "react-bootstrap";
import Chart from "chart.js/auto"; 
import axios from "axios";
import socket from "../socket";

export default function Dashboard() {
  const todayStr = new Date().toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 'queue' | 'units' | 'lab_active' | 'lab_inactive' | null
  const [activeModal, setActiveModal] = useState(null); 

  const serviceCanvasRef = useRef(null);
  const labServicesCanvasRef = useRef(null);
  const serviceChartRef = useRef(null);
  const labServicesChartRef = useRef(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:3000/api/dashboard/stats", {
        params: { startDate, endDate }
      });
      setData(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Erreur de liaison avec l'API de reporting.");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
    socket.on("patients_updated", fetchDashboardData);
    socket.on("examens_updated", fetchDashboardData);

    return () => {
      socket.off("patients_updated", fetchDashboardData);
      socket.off("examens_updated", fetchDashboardData);
    };
  }, [fetchDashboardData]);

  useEffect(() => {
    if (loading || !data) return;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    };

    if (serviceChartRef.current) serviceChartRef.current.destroy();
    if (serviceCanvasRef.current) {
      serviceChartRef.current = new Chart(serviceCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.services.map(s => s.nom_consul),
          datasets: [{
            data: data.services.map(s => s.nombre_patients),
            backgroundColor: "rgba(13, 148, 136, 0.8)",
            borderRadius: 4
          }]
        },
        options
      });
    }

    if (labServicesChartRef.current) labServicesChartRef.current.destroy();
    if (labServicesCanvasRef.current) {
      labServicesChartRef.current = new Chart(labServicesCanvasRef.current, {
        type: "bar",
        data: {
          labels: data.demandesExamensServices.map(d => d.service_origine),
          datasets: [{
            data: data.demandesExamensServices.map(d => d.total_demandes),
            backgroundColor: "rgba(79, 70, 229, 0.8)",
            borderRadius: 4
          }]
        },
        options: { ...options, indexAxis: 'y' }
      });
    }

    return () => {
      if (serviceChartRef.current) serviceChartRef.current.destroy();
      if (labServicesChartRef.current) labServicesChartRef.current.destroy();
    };
  }, [loading, data]);

  // Helper pour styliser les statuts du laboratoire
  const getStatutBadge = (statut) => {
    switch (statut?.toLowerCase()) {
      case "nouveau": return <Badge bg="danger">Nouveau</Badge>;
      case "en_attente": return <Badge bg="warning" text="dark">En attente</Badge>;
      case "termine": case "terminé": return <Badge bg="success">Terminé</Badge>;
      case "cloture": case "clôturé": return <Badge bg="secondary">Clôturé</Badge>;
      default: return <Badge bg="info">{statut}</Badge>;
    }
  };

  return (
    <Container fluid className="px-4 py-4" style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      
      {/* Barre supérieure & Filtres */}
      <Card className="border-0 shadow-sm p-3 mb-4 bg-white">
        <Row className="align-items-center g-3">
          <Col md={4}>
            <h3 className="fw-bold text-dark m-0">📊 Console De Suivi Chronologique</h3>
            <small className="text-muted">Monitoring global basé sur vos tables de données</small>
          </Col>
          <Col md={8} className="d-flex justify-content-md-end align-items-center gap-2">
            <Form.Group className="d-flex align-items-center m-0">
              <Form.Label className="me-2 mb-0 text-nowrap small fw-bold text-secondary">Du :</Form.Label>
              <Form.Control type="date" size="sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Form.Group>
            <Form.Group className="d-flex align-items-center m-0">
              <Form.Label className="me-2 mb-0 text-nowrap small fw-bold text-secondary">Au :</Form.Label>
              <Form.Control type="date" size="sm" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Form.Group>
            <Button variant="primary" size="sm" className="fw-semibold px-3" onClick={fetchDashboardData}>Filtrer</Button>
          </Col>
        </Row>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
      ) : (
        <>
          {/* Cartes KPI Rendu Cliquable */}
          <Row className="mb-4 g-3">
            <Col md={3}>
              <Card className="border-0 shadow-sm border-start border-primary border-4 bg-white shadow-hover" onClick={() => setActiveModal('queue')} style={{ cursor: 'pointer' }}>
                <Card.Body>
                  <span className="text-muted text-uppercase small small fw-bold">File d'attente Patients</span>
                  <h2 className="fw-bold text-primary mt-1 m-0">{data.kpis.totalPatients}</h2>
                  <small className="text-muted">🔍 Ouvrir le registre détaillé</small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3}>
              <Card className="border-0 shadow-sm border-start border-success border-4 bg-white shadow-hover" onClick={() => setActiveModal('units')} style={{ cursor: 'pointer' }}>
                <Card.Body>
                  <span className="text-muted text-uppercase small fw-bold">Médecins actifs</span>
                  <h2 className="fw-bold text-success mt-1 m-0">{data.kpis.totalServices}</h2>
                  <small className="text-muted">🔍 Voir le catalogue des pôles</small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3}>
              <Card className="border-0 shadow-sm border-start border-warning border-4 bg-white shadow-hover" onClick={() => setActiveModal('lab_active')} style={{ cursor: 'pointer' }}>
                <Card.Body>
                  <span className="text-muted text-uppercase small fw-bold">Analyses Labo Actives</span>
                  <h2 className="fw-bold text-warning mt-1 m-0">{data.kpis.examensActifs}</h2>
                  <small className="text-muted">🔍 Liste (Nouveau / En attente)</small>
                </Card.Body>
              </Card>
            </Col>

            <Col md={3}>
              <Card className="border-0 shadow-sm border-start border-secondary border-4 bg-white shadow-hover" onClick={() => setActiveModal('lab_inactive')} style={{ cursor: 'pointer' }}>
                <Card.Body>
                  <span className="text-muted text-uppercase small fw-bold">Analyses Labo Terminées</span>
                  <h2 className="fw-bold text-secondary mt-1 m-0">{data.kpis.examensInactifs}</h2>
                  <small className="text-muted">🔍 Registre des examens clos</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Graphiques */}
          <Row className="g-4 mb-4">
            <Col lg={6}>
              <Card className="border-0 shadow-sm p-3 bg-white">
                <h6 className="fw-bold text-secondary mb-3">Nombre d'Inscriptions par Unité</h6>
                <div style={{ height: "250px" }}><canvas ref={serviceCanvasRef} /></div>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="border-0 shadow-sm p-3 bg-white">
                <h6 className="fw-bold text-secondary mb-3">Demandes d'Examens émanant des Services</h6>
                <div style={{ height: "250px" }}><canvas ref={labServicesCanvasRef} /></div>
              </Card>
            </Col>
          </Row>

          {/* MODAL 1 : FILE D'ATTENTE PATIENTS */}
          <Modal show={activeModal === 'queue'} onHide={() => setActiveModal(null)} size="lg" centered>
            <Modal.Header closeButton><Modal.Title className="fw-bold fs-5">📋 Registre des Patients Inscrits</Modal.Title></Modal.Header>
            <Modal.Body>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <Table responsive striped hover className="align-middle border m-0">
                  <thead className="table-light sticky-top">
                    <tr><th style={{ width: "60px" }}>#</th><th>Date d'entrée</th><th>Nom & Prénom</th><th>Sexe</th><th>Pôle</th><th>Règlement</th></tr>
                  </thead>
                  <tbody>
                    {data.fileAttente.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-3 text-muted">Aucun patient inscrit.</td></tr>
                    ) : (
                      data.fileAttente.map(p => (
                        <tr key={p.id_patient}>
                          <td className="fw-bold text-secondary fw-mono">{p.index}</td>
                          <td className="fw-mono small">{new Date(p.date_creation).toLocaleString("fr-FR")}</td>
                          <td className="fw-bold text-dark">{p.nom} {p.prenom}</td>
                          <td>{p.sexe}</td>
                          <td><Badge bg="info" className="text-dark">{p.consultation}</Badge></td>
                          <td><Badge bg={p.statut_paye === "payé" ? "success" : "danger"}>{p.statut_paye?.toUpperCase() || "NON PAYÉ"}</Badge></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Modal.Body>
          </Modal>

          {/* MODAL 2 : UNITÉS DE SOINS */}
          <Modal show={activeModal === 'units'} onHide={() => setActiveModal(null)} size="lg" centered>
            <Modal.Header closeButton><Modal.Title className="fw-bold fs-5">🏢 Unités de Soins</Modal.Title></Modal.Header>
            <Modal.Body>
              <Table responsive striped hover className="align-middle border m-0">
                <thead className="table-light">
                  <tr><th style={{ width: "60px" }}>#</th><th>Unité Hospitalière</th><th>Praticien</th><th className="text-center">Consultations</th><th className="text-center">Examens</th><th className="text-end">Tarif</th></tr>
                </thead>
                <tbody>
                  {data.unitesSoins.map(u => (
                    <tr key={u.id}>
                      <td className="fw-bold text-primary fw-mono">{u.index}</td>
                      <td className="fw-bold text-dark">{u.nom_consul}</td>
                      <td className="text-secondary fw-semibold">{u.medecin !== 'Aucune demande' ? `Dr. ${u.medecin}` : "❌ Non assigné"}</td>
                      <td className="text-center"><Badge bg="primary">{u.consultations_effectuees} patient(s)</Badge></td>
                      <td className="text-center"><Badge bg="indigo" style={{backgroundColor:"#4f46e5"}}>{u.prescriptions_laboratoire} ordonnance(s)</Badge></td>
                      <td className="text-end fw-mono text-success fw-bold">{parseFloat(u.prix || 0).toLocaleString()} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Modal.Body>
          </Modal>

          {/* MODAL 3 : ANALYSES LABO ACTIVES */}
          <Modal show={activeModal === 'lab_active'} onHide={() => setActiveModal(null)} size="lg" centered>
            <Modal.Header closeButton className="bg-warning-subtle">
              <Modal.Title className="fw-bold fs-5 text-warning-dark">🧪 Demandes d'Analyses en Cours de Traitement</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <Table responsive striped hover className="align-middle border m-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: "60px" }}>#</th>
                      <th>Date Demande</th>
                      <th>Patient</th>
                      <th>Service Origine</th>
                      <th>Médecin Prescripteur</th>
                      <th className="text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.examensActifsList.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-3 text-muted">Aucune analyse active sur cette période.</td></tr>
                    ) : (
                      data.examensActifsList.map(e => (
                        <tr key={e.id_demande}>
                          <td className="fw-bold text-warning fw-mono">{e.index}</td>
                          <td className="fw-mono small">{new Date(e.date_demande).toLocaleString("fr-FR")}</td>
                          <td className="fw-bold text-dark">{e.nom} {e.prenom} <small className="text-muted">({e.sexe})</small></td>
                          <td><Badge bg="light" className="text-dark border">{e.service_origine}</Badge></td>
                          <td className="fw-semibold text-secondary">Dr. {e.medecin || "Non renseigné"}</td>
                          <td className="text-center">{getStatutBadge(e.statut)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Modal.Body>
          </Modal>

          {/* MODAL 4 : ANALYSES LABO TERMINÉES */}
          <Modal show={activeModal === 'lab_inactive'} onHide={() => setActiveModal(null)} size="lg" centered>
            <Modal.Header closeButton className="bg-success-subtle">
              <Modal.Title className="fw-bold fs-5 text-success">✅ Historique des Analyses Traitées & Clôturées</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                <Table responsive striped hover className="align-middle border m-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th style={{ width: "60px" }}>#</th>
                      <th>Date Demande</th>
                      <th>Patient</th>
                      <th>Service Origine</th>
                      <th>Médecin Prescripteur</th>
                      <th className="text-center">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.examensInactifsList.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-3 text-muted">Aucun examen traité sur cette période.</td></tr>
                    ) : (
                      data.examensInactifsList.map(e => (
                        <tr key={e.id_demande}>
                          <td className="fw-bold text-success fw-mono">{e.index}</td>
                          <td className="fw-mono small">{new Date(e.date_demande).toLocaleString("fr-FR")}</td>
                          <td className="fw-bold text-dark">{e.nom} {e.prenom} <small className="text-muted">({e.sexe})</small></td>
                          <td><Badge bg="light" className="text-dark border">{e.service_origine}</Badge></td>
                          <td className="fw-semibold text-secondary">Dr. {e.medecin || "Non renseigné"}</td>
                          <td className="text-center">{getStatutBadge(e.statut)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </Modal.Body>
          </Modal>
        </>
      )}
    </Container>
  );
}