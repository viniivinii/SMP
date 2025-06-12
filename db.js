const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "localhost",
  user: "consulta",     // geralmente "root"
  password: "45281020cC@#",
  database: "separacao"
});

module.exports = pool.promise(); // Permite usar async/await