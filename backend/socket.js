module.exports = (io) => {
  io.on("connection", (socket) => {

    socket.on("nouveau_patient", (data) => {
      io.emit("maj_patient", data);
    });

    socket.on("nouveau_examen", (data) => {
      io.emit("maj_patient", data);
    });

    socket.on("nouvelle_demande", (data) => {
      io.emit("maj_demande", data);
    });

    socket.on("resultat_saisi", (data) => {
      io.emit("maj_resultat", data);
    });

  });
};
