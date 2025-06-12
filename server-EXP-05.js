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
  database: 'estoque' // Nome do banco de dados
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
app.post("/iniciar", async (req, res) => {
  const { pedido, inicio, tipo } = req.body;

  if (!pedido || !inicio || !tipo) {
    return res.status(400).send("Faltam dados obrigatórios.");
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO estoque.pedidos (pedido, inicio, tipo, status) VALUES (?, ?, ?, ?)",
      [pedido, inicio, tipo, "em andamento"]
    );

    const pedidoId = result.insertId;

    res.json({ success: true, id: pedidoId });
  } catch (err) {
    console.error("Erro ao inserir pedido:", err);
    res.status(500).send("Erro ao salvar no banco de dados.");
  }
});

app.post("/itens", async (req, res) => {
  const { pedido_id, sku, qtd, hardware, modelo } = req.body;

  if (!pedido_id || !sku || !qtd) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes" });
  }

  try {
    // Verifica se já existe o SKU para esse pedido
    const [existente] = await db.execute(
      `SELECT id, qtd FROM estoque.itens_separados WHERE pedido_id = ? AND sku = ?`,
      [pedido_id, sku]
    );

    if (existente.length > 0) {
      // Se já existe, soma as quantidades
      const novoTotal = existente[0].qtd + qtd;
      await db.execute(
        `UPDATE estoque.itens_separados
         SET qtd = ?, hardware = ?, modelo = ?
         WHERE id = ?`,
        [novoTotal, hardware, modelo, existente[0].id]
      );
    } else {
      // Se não existe, insere novo
      await db.execute(
        `INSERT INTO estoque.itens_separados (pedido_id, sku, qtd, hardware, modelo)
         VALUES (?, ?, ?, ?, ?)`,
        [pedido_id, sku, qtd, hardware, modelo]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao adicionar item separado:", err);
    res.status(500).json({ error: "Erro ao salvar item separado" });
  }
});



// 📝 Atualizar pedido
app.post("/enviar", async (req, res) => {
  const { pedidoId, qtd_memoria, qtd_processador } = req.body;

  if (!pedidoId) {
    return res.status(400).json({ error: "ID do pedido é obrigatório" });
  }

  try {
    await db.execute(
      `UPDATE estoque.pedidos
       SET status = 'separado', qtd_memoria = ?, qtd_processador = ?
       WHERE id = ?`,
      [qtd_memoria || 0, qtd_processador || 0, pedidoId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao enviar pedido:", err);
    console.log("📥 Requisição recebida:", req.body);
    
    res.status(500).json({ error: "Erro ao atualizar pedido" });
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
    const [rows] = await db.query("SELECT * FROM estoque.pedidos WHERE status = 'em andamento'");
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err);
    res.status(500).send("Erro no servidor");
  }
});
app.get("/pedidosexp", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM estoque.pedidos WHERE status = 'separado'");
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar pedidos:", err);
    res.status(500).send("Erro no servidor");
  }
});
app.get("/pedidos/:id", async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [pedidoRows] = await db.execute("SELECT * FROM estoque.pedidos WHERE id = ?", [pedidoId]);
    const [itensRows] = await db.execute("SELECT * FROM estoque.itens_pedido WHERE pedido_id = ?", [pedidoId]);

    if (pedidoRows.length === 0) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    const pedido = pedidoRows[0];
    pedido.itens = itensRows;
    res.json(pedido);
  } catch (err) {
    console.error("Erro ao buscar pedido:", err);
    res.status(500).json({ error: "Erro ao buscar pedido" });
  }
});

app.get('/itens/:pedido_id', async (req, res) => {
  const { pedido_id } = req.params;
  
  try {
    const [rows] = await db.execute(
      `SELECT * FROM itens_separados 
       WHERE pedido_id = ?`, // Removi o filtro de status para debug
      [pedido_id]
    );
    
    console.log(`Itens encontrados para pedido ${pedido_id}:`, rows); // Debug
    res.json(rows);
    
  } catch (err) {
    console.error("Erro detalhado:", err);
    res.status(500).json({ 
      error: "Erro ao buscar itens",
      detalhes: err.message 
    });
  }
});

app.get("/itens/:pedido_id", async (req, res) => {
  const { pedido_id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT * FROM estoque.itens_separados WHERE pedido_id = ?`,
      [pedido_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar SKUs separados:", err);
    res.status(500).json({ error: "Erro ao buscar dados" });
  }
});

app.put("/pedidos/:id/voltar", async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [result] = await pool.execute(
      "UPDATE estoque.pedidos SET status = 'em andamento' WHERE id = ?",
      [pedidoId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Pedido não encontrado." });
    }

    res.json({ success: true, message: "Pedido retornado para o estoque com sucesso." });
  } catch (error) {
    console.error("Erro ao retornar pedido para o estoque:", error);
    res.status(500).json({ success: false, message: "Erro interno ao retornar pedido." });
  }
});

// ... (configurações iniciais mantidas)



// Rota para criar embalagens (Blisters ou Caixas)
app.post('/embalagens', async (req, res) => {
  const { pedido_id, tipo } = req.body; // 'tipo' = 'B' ou 'C'

  try {
    const [result] = await db.execute(
      `INSERT INTO embalagens (pedido_id, tipo, status) 
       VALUES (?, ?, 'aberto')`,
      [pedido_id, tipo]
    );

    res.json({ 
      id: result.insertId,
      tipo,
      status: 'aberto'
    });
  } catch (err) {
    console.error("Erro ao criar embalagem:", err);
    res.status(500).json({ error: "Erro ao criar embalagem." });
  }
});

app.delete("/itens/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.execute(`DELETE FROM estoque.itens_separados WHERE id = ?`, [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro ao deletar SKU:", err);
    res.status(500).json({ error: "Erro ao deletar SKU" });
  }
});


// 🗑️ Excluir um pedido pelo ID
app.delete("/pedidos/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await db.execute("DELETE FROM estoque.pedidos WHERE id = ?", [id]);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erro ao deletar pedido:", err);
    res.status(500).send("Erro ao cancelar pedido");
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
