const fs = require('fs');
const path = require("path");
const https = require("https");
const mysql = require('mysql2/promise');
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

//post
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
// app.post("/embalagens", async (req, res) => {
//   const { pedido_id, tipo, status } = req.body;

//   if (!pedido_id || !tipo || !status) {
//     return res.status(400).json({ error: "Dados obrigatórios ausentes" });
//   }

//   try {
//     await db.execute(
//       "INSERT INTO estoque.embalagens (pedido_id, tipo, status) VALUES (?, ?, ?)",
//       [pedido_id, tipo, status]
//     );
//     res.json({ success: true });
//   } catch (err) {
//     console.error("Erro ao criar embalagem:", err);
//     res.status(500).json({ error: "Erro ao criar embalagem" });
//   }
// });
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
app.post("/embalagens/distribuir", async (req, res) => {
  const { pedido_id, item_id, sku, qtd, hardware, dissipador } = req.body;

  if (!pedido_id || !sku || !qtd || !hardware) {
    return res.status(400).json({ error: "Faltam dados obrigatórios" });
  }

  const tipoEmb = hardware === "Processador" ? "caixa" : "blister";
  const capacidadeMax = tipoEmb === "caixa" ? 100 : (dissipador ? 22 : 25);

  try {
    const [embalagens] = await db.execute(`
      SELECT e.id,
        COALESCE(SUM(ei.qtd), 0) AS ocupado
      FROM estoque.embalagens e
      LEFT JOIN estoque.embalagens_itens ei ON e.id = ei.embalagem_id
      WHERE e.pedido_id = ? AND e.tipo = ? AND e.status = 'aberto'
      GROUP BY e.id
      ORDER BY e.id
    `, [pedido_id, tipoEmb]);

    if (!embalagens.length) {
      const msg = tipoEmb === "caixa" ? "Nenhuma caixa aberta disponível" : "Nenhum blister aberto disponível";
      return res.status(400).json({ error: msg });
    }

    let restante = qtd;
    let distribuido = 0;

    for (const emb of embalagens) {
      const capacidadeDisponivel = capacidadeMax - emb.ocupado;

      if (capacidadeDisponivel <= 0) continue;

      const inserir = Math.min(restante, capacidadeDisponivel);

      const [exist] = await db.execute(
        `SELECT id, qtd FROM estoque.embalagens_itens WHERE embalagem_id = ? AND sku = ?`,
        [emb.id, sku]
      );

      if (exist.length) {
        await db.execute(
          `UPDATE estoque.embalagens_itens SET qtd = ? WHERE id = ?`,
          [exist[0].qtd + inserir, exist[0].id]
        );
      } else {
        await db.execute(
          `INSERT INTO estoque.embalagens_itens (embalagem_id, sku, qtd)
           VALUES (?, ?, ?)`,
          [emb.id, sku, inserir]
        );
      }

      restante -= inserir;
      distribuido += inserir;

      const novoOcupado = emb.ocupado + inserir;
      if (novoOcupado >= capacidadeMax) {
        await db.execute(
          `UPDATE estoque.embalagens SET status = 'fechado' WHERE id = ?`,
          [emb.id]
        );
      }

      if (restante <= 0) break;
    }

    if (distribuido > 0 && item_id) {
      const [rows] = await db.execute(
        `SELECT * FROM estoque.itens_separados WHERE id = ?`,
        [item_id]
      );
      if (rows.length) {
        const item = rows[0];
        if (distribuido < item.qtd) {
          await db.execute(
            `UPDATE estoque.itens_separados SET qtd = ?, status = 'separado' WHERE id = ?`,
            [item.qtd - distribuido, item_id]
          );
          await db.execute(
            `INSERT INTO estoque.itens_separados (pedido_id, sku, qtd, hardware, modelo, status)
             VALUES (?, ?, ?, ?, ?, 'preparado')`,
            [item.pedido_id, item.sku, distribuido, item.hardware, item.modelo]
          );
        } else {
          await db.execute(
            `UPDATE estoque.itens_separados SET status = 'preparado' WHERE id = ?`,
            [item_id]
          );
        }
      }
    }

    if (restante > 0) {
      const aviso = tipoEmb === "caixa" ? "caixas" : "blisters";
      return res.status(206).json({ warning: `Parcialmente distribuído. Faltaram ${restante} unidades. Crie mais ${aviso}.` });
    }

    res.json({ success: true, distribuido });

  } catch (err) {
    console.error("Erro ao distribuir SKU:", err);
    res.status(500).json({ error: "Erro interno na distribuição" });
  }
});
app.post('/embalagens/:id/adicionar-sku', async (req, res) => {
  const { id } = req.params;
  const { item_id, sku, qtd } = req.body;
  if (!item_id || !sku || !qtd) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  }

  try {
    const [[info]] = await db.execute(
      'SELECT tipo FROM estoque.embalagens WHERE id = ?',
      [id]
    );
    if (!info) {
      return res.status(404).json({ error: 'Embalagem não encontrada' });
    }
    const [[ocup]] = await db.execute(
      'SELECT COALESCE(SUM(qtd),0) as ocupado FROM estoque.embalagens_itens WHERE embalagem_id = ?',
      [id]
    );
    const capacidade = info.tipo === 'caixa' ? 100 : 25;
    const disponivel = capacidade - ocup.ocupado;
    const inserir = Math.min(qtd, disponivel);

    const [exist] = await db.execute(
      'SELECT id, qtd FROM estoque.embalagens_itens WHERE embalagem_id = ? AND sku = ?',
      [id, sku]
    );
    if (exist.length) {
      await db.execute('UPDATE estoque.embalagens_itens SET qtd = ? WHERE id = ?', [exist[0].qtd + inserir, exist[0].id]);
    } else {
      await db.execute('INSERT INTO estoque.embalagens_itens (embalagem_id, sku, qtd) VALUES (?, ?, ?)', [id, sku, inserir]);
    }

    const [[item]] = await db.execute('SELECT * FROM estoque.itens_separados WHERE id = ?', [item_id]);
    if (item) {
      if (inserir < item.qtd) {
        await db.execute('UPDATE estoque.itens_separados SET qtd = ?, status = "separado" WHERE id = ?', [item.qtd - inserir, item_id]);
        await db.execute('INSERT INTO estoque.itens_separados (pedido_id, sku, qtd, hardware, modelo, status) VALUES (?, ?, ?, ?, ?, "preparado")', [item.pedido_id, item.sku, inserir, item.hardware, item.modelo]);
      } else {
        await db.execute('UPDATE estoque.itens_separados SET status = "preparado" WHERE id = ?', [item_id]);
      }
    }

    if (ocup.ocupado + inserir >= capacidade) {
      await db.execute('UPDATE estoque.embalagens SET status = "fechado" WHERE id = ?', [id]);
    }

    res.json({ success: true, inserido: inserir });
  } catch (err) {
    console.error('Erro ao adicionar SKU na embalagem:', err);
    res.status(500).json({ error: 'Erro ao adicionar SKU' });
  }
});

//put
app.put('/pedidos/:id/finalizar', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute(
      `UPDATE estoque.pedidos SET fim = NOW(), status = 'preparado' WHERE id = ?`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao finalizar pedido:', err);
    res.status(500).json({ error: 'Erro ao finalizar pedido' });
  }
});
app.put("/pedidos/:id/voltar", async (req, res) => {
  const pedidoId = req.params.id;

  try {
    const [result] = await db.execute(
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
app.put("/itens-preparados/:id", async (req, res) => {
  const { id } = req.params;
  const { status, qtd } = req.body;

  try {
    const [rows] = await db.execute(
      `SELECT * FROM estoque.itens_separados WHERE id = ?`,
      [id]
    );

    const item = rows[0];
    const qtdPrep = qtd ? parseInt(qtd, 10) : item.qtd;

    if (qtdPrep < item.qtd) {
      await db.execute(
        `UPDATE estoque.itens_separados SET qtd = ?, status = 'separado' WHERE id = ?`,
        [item.qtd - qtdPrep, id]
      );

      await db.execute(
        `INSERT INTO estoque.itens_separados (pedido_id, sku, qtd, hardware, modelo, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [item.pedido_id, item.sku, qtdPrep, item.hardware, item.modelo, status]
      );
    } else {
      await db.execute(
        `UPDATE estoque.itens_separados SET status = ? WHERE id = ?`,
        [status, id]
      );
    }


    res.json({ success: true });
  } catch (err) {
    console.error("Erro no update de item:", err);
    res.status(500).json({ error: "Erro ao atualizar item." });
  }
});
app.put("/embalagens/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["aberto", "fechado"].includes(status)) {
    return res.status(400).json({ error: "Status inválido" });
  }

  try {
    await db.execute(
      "UPDATE estoque.embalagens SET status = ? WHERE id = ?",
      [status, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar status da embalagem:", err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

//get
app.get('/skus', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM separacao.skus');
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar SKUs:', err);
    res.status(500).json({ error: 'Erro ao buscar SKUs' });
  }
});
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
app.get("/pedidosprep", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM estoque.pedidos WHERE status = 'preparado'");
    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar pedidos preparados:", err);
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
app.get('/embalagens/:pedido_id', async (req, res) => {
  const { pedido_id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT e.*, COALESCE(SUM(ei.qtd),0) AS ocupado
       FROM estoque.embalagens e
       LEFT JOIN estoque.embalagens_itens ei ON e.id = ei.embalagem_id
       WHERE e.pedido_id = ?
       GROUP BY e.id`,
      [pedido_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar embalagens:", err);
    res.status(500).json({ error: "Erro ao buscar embalagens" });
  }
});
app.get("/sku-emblist/:pedido_id", async (req, res) => {
  const { pedido_id } = req.params;

  try {
    const [rows] = await db.execute(`
      SELECT 
        ei.sku, ei.qtd, ei.embalagem_id, e.tipo
      FROM estoque.embalagens_itens ei
      JOIN estoque.embalagens e ON ei.embalagem_id = e.id
      WHERE e.pedido_id = ?
      ORDER BY ei.sku, ei.embalagem_id
    `, [pedido_id]);

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar SKUs em embalagens:", err);
    res.status(500).json({ error: "Erro ao buscar SKUs em embalagens" });
  }
});

//delete
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
app.delete("/embalagens/:id", async (req, res) => {
  const embalagemId = req.params.id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[emb]] = await conn.execute(
      "SELECT pedido_id FROM estoque.embalagens WHERE id = ?",
      [embalagemId]
    );
    if (!emb) {
      await conn.rollback();
      return res.status(404).json({ error: "Embalagem não encontrada" });
    }

    const pedidoId = emb.pedido_id;
    const [itens] = await conn.execute(
      "SELECT sku, qtd FROM estoque.embalagens_itens WHERE embalagem_id = ?",
      [embalagemId]
    );

    for (const { sku, qtd } of itens) {
      let restante = qtd;
      while (restante > 0) {
        const [[prep]] = await conn.execute(
          `SELECT id, qtd, hardware, modelo FROM estoque.itens_separados
           WHERE pedido_id = ? AND sku = ? AND status = 'preparado' LIMIT 1`,
          [pedidoId, sku]
        );
        if (!prep) break;

        const remover = Math.min(prep.qtd, restante);
        const novoQtd = prep.qtd - remover;
        if (novoQtd > 0) {
          await conn.execute(
            "UPDATE estoque.itens_separados SET qtd = ? WHERE id = ?",
            [novoQtd, prep.id]
          );
        } else {
          await conn.execute(
            "DELETE FROM estoque.itens_separados WHERE id = ?",
            [prep.id]
          );
        }

        const [sepRows] = await conn.execute(
          `SELECT id FROM estoque.itens_separados
           WHERE pedido_id = ? AND sku = ? AND status = 'separado'`,
          [pedidoId, sku]
        );

        if (sepRows.length) {
          await conn.execute(
            "UPDATE estoque.itens_separados SET qtd = qtd + ? WHERE id = ?",
            [remover, sepRows[0].id]
          );
        } else {
          await conn.execute(
            `INSERT INTO estoque.itens_separados
             (pedido_id, sku, qtd, hardware, modelo, status)
             VALUES (?, ?, ?, ?, ?, 'separado')`,
            [pedidoId, sku, remover, prep.hardware, prep.modelo]
          );
        }

        restante -= remover;
      }
    }

    await conn.execute(
      "DELETE FROM estoque.embalagens_itens WHERE embalagem_id = ?",
      [embalagemId]
    );
    await conn.execute(
      "DELETE FROM estoque.embalagens WHERE id = ?",
      [embalagemId]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error("Erro ao excluir embalagem:", err);
    res.status(500).json({ error: "Erro ao excluir embalagem" });
      } finally {
    conn.release();
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
app.delete("/pedidos/:id", async (req, res) => {
  const id = req.params.id;
  
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      "DELETE FROM estoque.embalagens_itens WHERE embalagem_id IN (SELECT id FROM estoque.embalagens WHERE pedido_id = ?)",
      [id]
    );
    await conn.execute(
      "DELETE FROM estoque.embalagens WHERE pedido_id = ?",
      [id]
    );
    await conn.execute(
      "DELETE FROM estoque.itens_separados WHERE pedido_id = ?",
      [id]
    );
    await conn.execute(
      "DELETE FROM estoque.pedidos WHERE id = ?",
      [id]
    );

    await conn.commit();
    res.sendStatus(200);
  } catch (err) {
    await conn.rollback();
    console.error("Erro ao deletar pedido:", err);
    res.status(500).send("Erro ao cancelar pedido");
    } finally {
    conn.release();
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
