const https = require("https");
const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();
const PORT = 443;

app.use(express.static(path.join(__dirname, ".")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};

https.createServer({
    key: fs.readFileSync(path.join(__dirname, 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
  }, app).listen(3000, '0.0.0.0', () => {
    console.log('Servidor HTTPS rodando em https://0.0.0.0:3000');
  });
  
