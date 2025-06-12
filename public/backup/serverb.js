const fs = require('fs');
const path = require("path");
const https = require("https");
const mysql = require('mysql2/promise'); // Usando a versão promise
const bodyParser = require("body-parser");
const cors = require("cors");
const express = require("express");

const PORT = 5501;
const app = express();

app.use(express.json());
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, ".")));

// Rota principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Configuração do MySQL
const dbConfig = {
  host: '10.10.2.94', // Endereço do servidor MySQL
  user: 'consulta', // Usuário do MySQL
  password: '45281020cC@#', // Senha do MySQL
  port: 3306, // Porta do MySQL
  database: 'separacao'
};

let db;
(async () => {
  try {
    // Cria um pool de conexões com a interface de Promise
    db = await mysql.createPool(dbConfig);
    console.log('✅ Conectado ao MySQL!');
  } catch (err) {
    console.error('Erro ao conectar no MySQL:', err);
    process.exit(1);
  }
})();

// ✅ Salvar vários SKUs com MySQL
app.post('/salvar-skus', async (req, res) => {
  const skus = req.body;

  if (!Array.isArray(skus)) {
    return res.status(400).send("Formato inválido. Esperado um array.");
  }

  try {
    const insertPromises = skus.map(({ SKU, hardware, modelo }) => {
      return db.execute(
        'INSERT IGNORE INTO separacao.skus (SKU, hardware, modelo) VALUES (?, ?, ?)',
        [SKU, hardware, modelo]
      );
    });

    await Promise.all(insertPromises);
    res.send("SKUs inseridos com sucesso.");
  } catch (err) {
    console.error("Erro ao inserir SKUs:", err);
    res.status(500).send("Erro ao inserir SKUs.");
  }
});

// Iniciar pedido
app.post('/iniciar', async (req, res) => {
  const { pedido, inicio } = req.body;

  if (!pedido || !inicio) {
    return res.status(400).send("Dados obrigatórios ausentes.");
  }

  try {
    const [result] = await db.execute(
      'INSERT IGNORE INTO separacao.pedidos (pedido, inicio) VALUES (?, ?)',
      [pedido, inicio]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    console.error("Erro ao inserir pedido:", err);
    res.status(500).send("Erro ao inserir pedido.");
  }
});

// 📝 Atualizar pedido
app.post('/finalizar', async (req, res) => {
  const { id, fim, skus } = req.body;

  if (!id || !fim || !Array.isArray(skus)) {
    return res.status(400).send("Dados inválidos. Envie id, fim e skus.");
  }

  try {
    // Atualiza a data de fim do pedido
    await db.execute(
      'UPDATE separacao.pedidos SET fim = ? WHERE id = ?',
      [fim, id]
    );

    // Insere os SKUs do pedido
    const insertions = skus.map(({ sku, qtdItem, qtdEmbalagem, dissipador, codigo, hardware, modelo }) => {
      return db.execute(
        `INSERT IGNORE INTO separacao.itens_pedido
         (pedido_id, sku, qtd_item, qtd_embalagem, dissipador, codigo, hardware, modelo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, sku, qtdItem, qtdEmbalagem, dissipador ? 1 : 0, codigo, hardware, modelo]
      );
    });

    await Promise.all(insertions);

    // Resposta para o cliente
    console.log("✅ Pedido finalizado com sucesso.");
    res.send("✅ Pedido finalizado com sucesso.");
  } catch (err) {
    console.error("Erro ao finalizar pedido:", err);
    res.status(500).send("❌ Erro ao finalizar pedido.");
  }
});

// 🗑️ Excluir SKU
app.delete('/excluir-sku/:sku', async (req, res) => {
  const sku = req.params.sku;
  try {
    const [result] = await db.execute('DELETE FROM separacao.skus WHERE SKU = ?', [sku]);
    if (result.affectedRows === 0) {
      return res.status(404).send("SKU não encontrado.");
    }
    res.send("SKU excluído com sucesso.");
  } catch (err) {
    console.error("Erro ao excluir SKU:", err);
    res.status(500).send("Erro ao excluir SKU.");
  }
});

// 🔍 Buscar todos os SKUs
app.get('/skus', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM separacao.skus');
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar SKUs:', err);
    res.status(500).json({ error: 'Erro ao buscar SKUs' });
  }
});

// 🕘 Listar todos os pedidos (para o histórico)
app.get("/pedidos", async (req, res) => {
  try {
    // Consulta todos os pedidos
    const [pedidos] = await db.execute("SELECT * FROM separacao.pedidos ORDER BY id DESC");

    // Consulta todos os itens relacionados
    const [itens] = await db.execute("SELECT * FROM separacao.itens_pedido");

    // Agrupa itens por pedido_id
    const pedidosComItens = pedidos.map(p => {
      const skus = itens.filter(item => item.pedido_id === p.id).map(item => {
        return {
          sku: item.sku,
          hardware: item.hardware,
          modelo: item.modelo,
          dissipador: !!item.dissipador,
          codigo: item.codigo,
          qtdMemorias: item.hardware === "Memória RAM" ? item.qtd_item : 0,
          qtdBlisters: item.hardware === "Memória RAM" ? item.qtd_embalagem : 0,
          qtdProcessadores: item.hardware === "Processador" ? item.qtd_item : 0,
          qtdCaixas: item.hardware === "Processador" ? item.qtd_embalagem : 0
        };
      });

      return {
        id: p.id,
        pedido: p.pedido,
        inicio: p.inicio,
        fim: p.fim,
        skus
      };
    });

    res.json(pedidosComItens);
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err);
    res.status(500).send("Erro ao buscar pedidos.");
  }
});

// 🗑️ Excluir um pedido pelo ID
app.delete("/pedido/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const [result] = await db.execute("DELETE FROM separacao.pedidos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).send("Pedido não encontrado.");
    }
    res.send("✅ Pedido excluído com sucesso.");
  } catch (err) {
    console.error("Erro ao excluir pedido:", err);
    res.status(500).send("Erro ao excluir pedido.");
  }
});

// Configurações HTTPS
const options = {
  key: fs.readFileSync(path.join(__dirname, "key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
};

const os = require('os');
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (let name in interfaces) {
    for (let iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`✅ Servidor HTTPS rodando em https://${ip}:${PORT}`);
});
