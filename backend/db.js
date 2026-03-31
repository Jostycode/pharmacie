const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "RESULTAT",
  password: "JoStY159",
  port: 5432
});

module.exports = pool;