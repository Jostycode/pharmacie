import React, { useEffect, useState } from "react";
import axios from "../api/axios";
import socket from "../socket";

function PatientsCRUD() {
  const [data, setData] = useState([]);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [sexe, setSexe] = useState("");
  const [age, setAge] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [editId, setEditId] = useState(null);

  const loadData = async () => {
    const r = await axios.get("/patients");
    setData(r.data);
  };

  useEffect(() => {
    loadData();
    socket.on("patients_updated", loadData);

    return () => socket.off("patients_updated", loadData);
  }, []);

  const submit = async (e) => {
    e.preventDefault();

    if (editId) {
      await axios.put(`/patients/${editId}`, { nom, prenom, sexe, age, telephone, adresse });
    } else {
      await axios.post("/patients", { nom, prenom, sexe, age, telephone, adresse });
    }

    setNom("");
    setPrenom("");
    setSexe("");
    setAge("");
    setTelephone("");
    setAdresse("");
    setEditId(null);
    loadData();
  };

  const del = async (id) => {
    if (window.confirm("Supprimer ?")) {
      await axios.delete(`/patients/${id}`);
      loadData();
    }
  };

  const edit = (p) => {
    setNom(p.nom);
    setNom(p.prenom);
    setNom(p.sexe);
    setAge(p.age);
    setNom(p.telephone);
    setNom(p.adresse);
    setEditId(p.id);
  };

  return (
    <div className="container">
      <h3>Patients</h3>

      <form onSubmit={submit} className="mb-3">
        <input
          className="form-control mb-2"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
        <input
          className="form-control mb-2"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setPrenom(e.target.value)}
        />
        <input
          className="form-control mb-2"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setSexe(e.target.value)}
        />
        <input
          className="form-control mb-2"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        <input
          className="form-control mb-2"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setTelephone(e.target.value)}
        />
        <input
          className="form-control mb-2"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setAdresse(e.target.value)}
        />
        <button className="btn btn-primary">
          {editId ? "Modifier" : "Ajouter"}
        </button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prenom</th>
            <th>Sexe</th>
            <th>Age</th>
            <th>Telephone</th>
            <th>Adresse</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {data.map((p) => (
            <tr key={p.id}>
              <td>{p.nom}</td>
              <td>{p.prenom}</td>
              <td>{p.sexe}</td>
              <td>{p.age}</td>
              <td>{p.telephone}</td>
              <td>{p.adresse}</td>
              <td>
                <button onClick={() => edit(p)} className="btn btn-warning btn-sm me-2">
                  Edit
                </button>
                <button onClick={() => del(p.id)} className="btn btn-danger btn-sm">
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PatientsCRUD;
