//variaveis globais
let pedidos = JSON.parse(localStorage.getItem("pedidosRAM") || "{}");
let pedidoAtual = localStorage.getItem("pedidoAtual") || null;
let tempoInicio = null;
let pedidoIdAtual = localStorage.getItem("pedidoIdAtual") || null;
let historicoPedidos = [];

const API_URL = "https://10.10.2.94:5501"; // URL do servidor Node.js

let skusCustomizados = JSON.parse(
  localStorage.getItem("skusCustomizados") || "[]"
);
let skuData = [];
let listaCompletaSKUs = [];
let listaFiltradaSKUs = [];
const { jsPDF } = window.jspdf;

let blistersAbertos = [];
let caixasAbertas = [];

let historicoPaginaAtual = 1;
let historicoItensPorPagina = 5;
let historicoTotalPaginas = 1;

let tipoSelecionado = null;

// Dados paginados para a tela de Preparação
let dadosSeparados = [];
let dadosPreparados = [];
let dadosEmbalagens = [];
let skusPorEmbalagem = {};

let paginaSeparados = 1;
let paginaPreparados = 1;
let paginaEmbalagens = 1;

const itensPorPaginaPreparacao = 10;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnHistorico").addEventListener("click", () => {
    atualizarHistoricoDoBanco();
  });
  carregarSKUs();
});

window.onload = () => {
  mostrarTela('telaEstoque');
};


window.addEventListener(
  "DOMContentLoaded",
  carregarSKUsDoBanco
);

function mostrarTela(idTela) {
  const todasTelas = [
    "telaEstoque",
    "telaExpedicao",
    "telaHistorico",
    "telaSkus",
    "telaPreparacao",
    "telaPedido"
  ];

  todasTelas.forEach((tela) => {
    const el = document.getElementById(tela);
    if (el) el.style.display = tela === idTela ? "block" : "none";
  });

  // Chamada de funções de carregamento específicas para cada tela
  switch (idTela) {
    case "telaEstoque":
      carregarPedidosEstoque(); // ESSA FUNÇÃO PREENCHE #listaPedidosEstoque
      break;
    case "telaExpedicao":
      carregarPedidosExpedicao();
      break;
    case "telaHistorico":
      carregarHistoricoPaginado();
      break;
    case "telaSkus":
      carregarSKUsDoBanco();
      break;
  }
}
// Carrega SKUs do banco de dados
async function carregarSKUsDoBanco() {
  try {
    const response = await fetch("https://10.10.2.94:5501/skus");
    if (!response.ok) throw new Error("Erro ao buscar SKUs");
    skuData = await response.json();
    console.log("SKUs carregados do banco:", skuData);
  } catch (error) {
    console.error("Erro ao carregar SKUs:", error);
    mostrarAviso("❌ Erro ao carregar SKUs do banco.", "#e74c3c");
  }
}
function carregarPedidosEstoque() {
  fetch("https://10.10.2.94:5501/pedidos")
    .then(res => res.json())
    .then(pedidos => {
      const lista = document.getElementById("listaPedidosEstoque");
      lista.innerHTML = "";

      if (pedidos.length === 0) {
        lista.innerHTML = "<p>Nenhum pedido em andamento.</p>";
        return;
      }

      pedidos.forEach(p => {
        const card = document.createElement("div");
        card.className = "card-pedido";
        card.innerHTML = `
          <h3>Pedido: ${p.pedido}</h3>
          <p><strong>Tipo:</strong> ${p.tipo}</p>
          <p><strong>Memórias:</strong> ${p.qtd_memoria || 0}</p>
          <p><strong>Processadores:</strong> ${p.qtd_processador || 0}</p>
          <button class="continuar" onclick="continuarPedido('${p.pedido}', ${p.id}, '${p.tipo}')">Continuar</button>
          <button class="cancelar" onclick="cancelarPedido(${p.id})">Cancelar</button>
        `;
        lista.appendChild(card);
      });
    })
    .catch(err => {
      console.error("Erro ao carregar pedidos:", err);
    });
}
function carregarPedidosExpedicao() {
  fetch("https://10.10.2.94:5501/pedidosexp")
    .then((res) => res.json())
    .then((pedidos) => {
      const lista = document.getElementById("listaPedidosExpedicao");
      lista.innerHTML = "";

      if (pedidos.length === 0) {
        lista.innerHTML = "<p>Nenhum pedido separado no momento.</p>";
        return;
      }

      pedidos.forEach((p) => {
        const card = document.createElement("div");
        card.className = "card-expedicao";
        card.innerHTML = `
          <strong>Pedido:</strong> ${p.pedido}<br>
          <strong>Tipo:</strong> ${p.tipo}<br>
          <strong>Memórias:</strong> ${p.qtd_memoria || 0} | Processadores: ${p.qtd_processador || 0}<br>
          <button id="btnPrepararPedido" onclick="iniciarPreparacao(${p.id}, '${p.pedido}')" style="margin-right: 10px;">Preparar</button>
          <button id="btnVoltarPedido" onclick="voltarParaEstoqueStatus(${p.id})">Voltar</button>
        `;
        lista.appendChild(card);
      });
    })
    .catch((err) => {
      console.error("Erro ao carregar pedidos separados:", err);
    });
}

async function carregarSkusSeparados() {
  try {
    console.log(`Buscando itens para pedido ${pedidoIdAtual}`);
    
    const response = await fetch(`https://10.10.2.94:5501/itens/${pedidoIdAtual}`);
    
    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }
    
    const itens = await response.json();
    console.log("Itens recebidos:", itens);
    
    const itensSeparados = itens.filter(item => item.status === "separado");
    const itensPreparados = itens.filter(item => item.status === "preparado");

    dadosSeparados = itensSeparados;
    dadosPreparados = itensPreparados;
    paginaSeparados = 1;
    paginaPreparados = 1;

    const totalSeparados = itensSeparados.reduce((sum, item) => sum + item.qtd, 0);
    const totalPreparados = itensPreparados.reduce((sum, item) => sum + item.qtd, 0);

    renderizarSeparadosPaginado();
    renderizarPreparadosPaginado();

    atualizarBarraProgresso(totalSeparados, totalPreparados);

  } catch (error) {
    console.error("Erro detalhado:", error);
    mostrarAviso(`❌ Falha ao carregar itens: ${error.message}`, "#e74c3c");

    document.getElementById("listaSeparados").innerHTML = `
      <div class="erro-carregamento">
        <p>Falha ao carregar itens</p>
        <button onclick="carregarSkusSeparados()">⟳ Tentar novamente</button>
      </div>
    `;

    atualizarBarraProgresso(0, 0);

  }
}

async function carregarEmbalagens(pedidoIdAtual) {
  try {
    const [resEmb, resSkus] = await Promise.all([
      fetch(`${API_URL}/embalagens/${pedidoIdAtual}`),
      fetch(`${API_URL}/sku-emblist/${pedidoIdAtual}`)
    ]);

    dadosEmbalagens = await resEmb.json();
    const itens = await resSkus.json();

    skusPorEmbalagem = {};
    itens.forEach(i => {
      if (!skusPorEmbalagem[i.embalagem_id]) skusPorEmbalagem[i.embalagem_id] = [];
      skusPorEmbalagem[i.embalagem_id].push({ sku: i.sku, qtd: i.qtd });
    });

    paginaEmbalagens = 1;

    renderizarEmbalagensPaginado();
    atualizarResumoPreparacao();
  } catch (err) {
    console.error("Erro ao carregar embalagens:", err);
    mostrarAviso("❌ Erro ao carregar embalagens", "#e74c3c");
  }
}

async function renderizarSkusPreparadosExpandido() {
  try {
    const res = await fetch(`${API_URL}/sku-emblist/${pedidoIdAtual}`);
    const data = await res.json();

    const agrupados = {};

    data.forEach(({ sku, qtd, embalagem_id, tipo }) => {
      if (!agrupados[sku]) agrupados[sku] = [];
      agrupados[sku].push({ embalagem_id, qtd, tipo });
    });

    const container = document.getElementById("listaPreparados");
    container.innerHTML = "";

    Object.entries(agrupados).forEach(([sku, embalagens]) => {
      const card = document.createElement("div");
      card.className = "card-preparado";
      const totalQtd = embalagens.reduce((s, e) => s + e.qtd, 0);

      const listaOculta = embalagens.map(e =>
        `<li>${e.tipo.toUpperCase()} #${e.embalagem_id} - ${e.qtd} un</li>`
      ).join("");

      card.innerHTML = `
        <div class="card-preparado">
          <div class="card-preparado-topo">
          <strong>${sku}</strong>
          <span class="qtd">${totalQtd} un</span>
        </div>
        <button class="btn-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">➕ Ver embalagens</button>
        <ul class="lista-embalagens hidden">${listaOculta}</ul>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (err) {
    console.error("Erro ao renderizar SKUs preparados:", err);
    document.getElementById("listaPreparados").innerHTML = `<p class='aviso'>Erro ao carregar SKUs preparados</p>`;
  }
}


function calcularQtdRecomendadaBlisters(itens) {
  const dissipador = false; // se quiser usar lógica futura de checkbox
  const porBlister = dissipador ? 22 : 25;

  const totalMemorias = itens
    .filter(i => i.hardware === "Memória RAM")
    .reduce((acc, i) => acc + i.qtd, 0);

  const recomendados = Math.ceil(totalMemorias / porBlister);
  return recomendados;
}

async function atualizarResumoPreparacao() {
  try {
    const [itens, embalagens] = await Promise.all([
      fetch(`https://10.10.2.94:5501/itens/${pedidoIdAtual}`).then(r => r.json()),
      fetch(`https://10.10.2.94:5501/embalagens/${pedidoIdAtual}`).then(r => r.json()),
    ]);

    let qtdMemorias = 0;
    let qtdProcessadores = 0;
    let totalSeparados = 0;
    let totalPreparados = 0;

    const itensPreparados = itens.filter(i => i.status === "preparado");
    const totalItensPreparados = itensPreparados.reduce((acc, i) => acc + i.qtd, 0);

    itens.forEach(item => {
      if (item.hardware === "Memória RAM") qtdMemorias += item.qtd;
      if (item.hardware === "Processador") qtdProcessadores += item.qtd;
      totalSeparados += item.qtd;
    });

    const recomendados = calcularQtdRecomendadaBlisters(itens);

    const resumo = `
      <div class="resumo-container">
        <div id="cardsResumo1">
          <div class="resumo-memoria">🧠 Memórias: ${qtdMemorias}</div>
          <div class="resumo-processador">🖥️ Processadores: ${qtdProcessadores}</div>
        </div>
        <div id="cardsResumo2">
          <div class="resumo-itens">📦 Itens Separados: ${totalSeparados}</div>
          <div class="resumo-preparados">✅ Itens Preparados: ${totalItensPreparados}</div>
        </div>
        <div id="cardsResumo3">
          <div class="resumo-recomendacao">🧮 Recomendados: ${recomendados}</div>
          <div class="resumo-embalagens">📦 Embalagens: ${embalagens.length}</div>
        </div>
      </div>
    `;

    const blocoResumo = document.getElementById("resumoPreparacao");
    if (blocoResumo) blocoResumo.innerHTML = resumo;
  } catch (error) {
    console.error("Erro ao atualizar resumo:", error);
  }
}

async function distribuirSkuParaBlisters(itemId, sku, qtd, hardware) {
  try {
    // Checar se há embalagens do tipo blister abertas
    const resposta = await fetch(`${API_URL}/embalagens/${pedidoIdAtual}`);
    const embalagens = await resposta.json();
    const blistersAbertos = embalagens.filter(e => e.tipo === 'blister' && e.status === 'aberto');

    if (blistersAbertos.length === 0) {
      return mostrarAviso("⚠️ Nenhum blister aberto disponível. Crie uma embalagem primeiro.", "#f39c12");
    }

    const dissipador = document.getElementById("dissipador")?.checked || false;

    // Enviar requisição para o backend
    const distrib = await fetch(`${API_URL}/embalagens/distribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedido_id: pedidoIdAtual,
        item_id: itemId,
        sku,
        qtd,
        hardware,
        dissipador
      })
    });

    const resultado = await distrib.json();

    if (distrib.status === 206) {
      mostrarAviso(`⚠️ Parcialmente distribuído: ${resultado.warning}`, "#f39c12");
    } else if (!distrib.ok) {
      mostrarAviso(`❌ Erro: ${resultado.error}`, "#e74c3c");
      return;
    } else {
      mostrarAviso("✅ SKU distribuído com sucesso!", "#2ecc71");
    }

    // Atualiza tudo na tela
    await carregarSkusSeparados();
    await carregarEmbalagens(pedidoIdAtual);

  } catch (err) {
    console.error("Erro na distribuição:", err);
    mostrarAviso("❌ Falha ao distribuir SKU nos blisters", "#e74c3c");
  }
}


async function excluirEmbalagem(id) {
  try {
    await fetch(`https://10.10.2.94:5501/embalagens/${id}`, {
      method: "DELETE",
    });
    await carregarEmbalagens(pedidoIdAtual);
  } catch (err) {
    console.error("Erro ao excluir embalagem:", err);
  }
}

async function alternarStatusBlister(id, statusAtual) {
  const novoStatus = statusAtual === "fechado" ? "aberto" : "fechado";

  try {
    await fetch(`${API_URL}/embalagens/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus })
    });

    mostrarAviso(`🔁 Blister ${id} agora está ${novoStatus.toUpperCase()}.`, "#3498db");
    await carregarEmbalagens(pedidoIdAtual);

  } catch (err) {
    console.error("Erro ao alternar status do blister:", err);
    mostrarAviso("❌ Falha ao atualizar status da embalagem", "#e74c3c");
  }
}


function renderizarEmbalagensPaginado() {
  const lista = document.getElementById("listaEmbalagens");
  lista.innerHTML = "";

  if (!dadosEmbalagens || dadosEmbalagens.length === 0) {
    lista.innerHTML = "<p>Nenhuma embalagem criada.</p>";
  } else {
    const inicio = (paginaEmbalagens - 1) * itensPorPaginaPreparacao;
    const pagina = dadosEmbalagens.slice(inicio, inicio + itensPorPaginaPreparacao);

    pagina.forEach((emb) => {
      const div = document.createElement("div");
      div.className = `card-embalagem ${emb.status === "fechado" ? "fechado" : "aberto"}`;

      const ocup = emb.ocupado || 0;
      const capacidade = 25;
      const perc = Math.round((ocup / capacidade) * 100);

      const itens = skusPorEmbalagem[emb.id] || [];
      const listaOculta = itens.map(i => `<li>${i.sku} - ${i.qtd} un</li>`).join("") || "<li>Vazio</li>";

      div.innerHTML = `
        <div class="header-embalagem">
          <strong>${emb.tipo.toUpperCase()} #${emb.id}</strong>
          <span>${emb.status === "fechado" ? "🔒 Fechado" : "🟢 Aberto"}</span>
        </div>
        <div class="lotacao">
          <div class="barra-lotacao"><div style="width:${perc}%"></div></div>
          <span>${perc}%</span>
        </div>
        <button class="btn-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">Ver SKUs</button>
        <ul class="lista-embalagens hidden">${listaOculta}</ul>
        <div class="acoes">
          <button onclick="alternarStatusBlister(${emb.id}, '${emb.status}')">
            ${emb.status === "fechado" ? "🔓 Abrir" : "✅ Fechar"}
          </button>
          <button onclick="excluirEmbalagem(${emb.id})">🗑️</button>
        </div>
      `;
      lista.appendChild(div);
    });
  }

  const totalPag = Math.ceil((dadosEmbalagens.length || 0) / itensPorPaginaPreparacao) || 1;
  document.getElementById("paginaEmbalagens").textContent = `${paginaEmbalagens} / ${totalPag}`;
  document.getElementById("btnEmbAnterior").disabled = paginaEmbalagens === 1;
  document.getElementById("btnEmbProximo").disabled = paginaEmbalagens === totalPag;
}

function atualizarBarraProgresso(separados, preparados) {
  const total = separados + preparados;

  // Evita divisão por zero
  const percSeparados = total > 0 ? Math.round((separados / total) * 100) : 0;
  const percPreparados = total > 0 ? Math.round((preparados / total) * 100) : 0;

  const barraSeparados = document.getElementById("progressoSeparados");
  const barraPreparados = document.getElementById("progressoPreparados");

  if (barraSeparados) {
    barraSeparados.style.width = `${percSeparados}%`;
    barraSeparados.textContent = `${percSeparados}% separados`;
  }

  if (barraPreparados) {
    barraPreparados.style.width = `${percPreparados}%`;
    barraPreparados.textContent = `${percPreparados}% prontos`;
  }
}

function renderizarSeparadosPaginado() {
  const area = document.getElementById("listaSeparados");
  area.innerHTML = "";

  if (dadosSeparados.length === 0) {
    area.innerHTML = "<p class='aviso'>Nenhum SKU para preparar</p>";
  } else {
    const inicio = (paginaSeparados - 1) * itensPorPaginaPreparacao;
    const pagina = dadosSeparados.slice(inicio, inicio + itensPorPaginaPreparacao);

    pagina.forEach(item => {
      const card = document.createElement("div");
      card.className = "card-preparacao";
      card.innerHTML = `
        <div class="card-header">
          <strong>${item.sku}</strong>
          <span class="qtd">${item.qtd} un</span>
        </div>
        <div class="card-body">
          <em>${item.modelo || 'Modelo não cadastrado'}</em>
        </div>
        <button class="btn-preparar" onclick="prepararItem(${item.id}, '${item.sku}', '${item.hardware}', ${item.qtd})">Adicionar</button>
      `;
      area.appendChild(card);
    });
  }

  const total = Math.ceil((dadosSeparados.length || 0) / itensPorPaginaPreparacao) || 1;
  document.getElementById("paginaSeparados").textContent = `${paginaSeparados} / ${total}`;
  document.getElementById("btnSepAnt").disabled = paginaSeparados === 1;
  document.getElementById("btnSepProx").disabled = paginaSeparados === total;
}

function renderizarPreparadosPaginado() {
  const area = document.getElementById("listaPreparados");
  area.innerHTML = "";

  if (dadosPreparados.length === 0) {
    area.innerHTML = "<p class='aviso'>Nenhum SKU preparado</p>";
  } else {
    const inicio = (paginaPreparados - 1) * itensPorPaginaPreparacao;
    const pagina = dadosPreparados.slice(inicio, inicio + itensPorPaginaPreparacao);

    pagina.forEach(item => {
      const card = document.createElement("div");
      card.className = "card-preparado";
      card.innerHTML = `
        <strong>${item.sku}</strong> - ${item.qtd} un
      `;
      area.appendChild(card);
    });
  }

  const total = Math.ceil((dadosPreparados.length || 0) / itensPorPaginaPreparacao) || 1;
  document.getElementById("paginaPreparados").textContent = `${paginaPreparados} / ${total}`;
  document.getElementById("btnPrepAnt").disabled = paginaPreparados === 1;
  document.getElementById("btnPrepProx").disabled = paginaPreparados === total;
}

function paginaAnteriorSeparados() {
  if (paginaSeparados > 1) {
    paginaSeparados--;
    renderizarSeparadosPaginado();
  }
}

function proximaPaginaSeparados() {
  const total = Math.ceil(dadosSeparados.length / itensPorPaginaPreparacao);
  if (paginaSeparados < total) {
    paginaSeparados++;
    renderizarSeparadosPaginado();
  }
}

function paginaAnteriorPreparados() {
  if (paginaPreparados > 1) {
    paginaPreparados--;
    renderizarPreparadosPaginado();
  }
}

function proximaPaginaPreparados() {
  const total = Math.ceil(dadosPreparados.length / itensPorPaginaPreparacao);
  if (paginaPreparados < total) {
    paginaPreparados++;
    renderizarPreparadosPaginado();
  }
}

function paginaAnteriorEmbalagens() {
  if (paginaEmbalagens > 1) {
    paginaEmbalagens--;
    renderizarEmbalagensPaginado();
  }
}

function proximaPaginaEmbalagens() {
  const total = Math.ceil(dadosEmbalagens.length / itensPorPaginaPreparacao);
  if (paginaEmbalagens < total) {
    paginaEmbalagens++;
    renderizarEmbalagensPaginado();
  }
}

async function prepararItem(itemId, sku, hardware, qtd) {
  try {
    const resposta = await fetch(`${API_URL}/itens-preparados/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "preparado", qtd })
    });

    if (!resposta.ok) throw new Error("Erro ao preparar item");

    // Distribuir automaticamente para blisters de memória
    if (hardware === "Memória RAM") {
      await distribuirSkuParaBlisters(itemId, sku, qtd, hardware);
    }

    // Recarrega interface
    await carregarSkusSeparados();
    renderizarSkusPreparadosExpandido();
    mostrarAviso("✅ Item movido para preparado.", "#2ecc71");

  } catch (err) {
    console.error("Erro ao preparar item:", err);
    mostrarAviso("❌ Falha ao mover item", "#e74c3c");
  }
}


function adicionarNovaEmbalagem() {
  if (!pedidoIdAtual) return;

  fetch("https://10.10.2.94:5501/embalagens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pedido_id: pedidoIdAtual,
      tipo: "blister", // ou "caixa" dependendo do uso posterior
      status: "aberto"
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        mostrarAviso("✅ Nova embalagem adicionada.", "#27ae60");
        carregarEmbalagens(); // você precisa ter uma função para atualizar a tela
      } else {
        mostrarAviso("❌ Falha ao adicionar embalagem.", "#e74c3c");
      }
    })
    .catch(err => {
      console.error("Erro ao adicionar embalagem:", err);
      mostrarAviso("❌ Erro no servidor.", "#e74c3c");
    });
}

function abrirModalEmbalagem() {
  document.getElementById("modalEmbalagem").classList.remove("hidden");
}

function fecharModalEmbalagem() {
  document.getElementById("modalEmbalagem").classList.add("hidden");
}

function selecionarTipoEmbalagem(tipo) {
  tipoSelecionado = tipo;

  // Atualiza visual
  document.getElementById("btnBlister").classList.remove("ativo");
  document.getElementById("btnCaixa").classList.remove("ativo");

  if (tipo === "blister") {
    document.getElementById("btnBlister").classList.add("ativo");
  } else {
    document.getElementById("btnCaixa").classList.add("ativo");
  }
}

async function confirmarNovaEmbalagem() {
  const quantidade = parseInt(document.getElementById("qtdEmbalagem").value);

  if (!tipoSelecionado) {
    mostrarAviso("❌ Selecione o tipo de embalagem.", "#e74c3c");
    return;
  }

  if (!quantidade || quantidade <= 0) {
    mostrarAviso("❌ Quantidade inválida.", "#e74c3c");
    return;
  }

  try {
    for (let i = 0; i < quantidade; i++) {
      await fetch("https://10.10.2.94:5501/embalagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: pedidoIdAtual,
          tipo: tipoSelecionado,
          status: "aberto"
        })
      });
    }

    mostrarAviso(`✅ ${quantidade} ${tipoSelecionado}(s) adicionados.`, "#2ecc71");
    fecharModalEmbalagem();
    await carregarEmbalagens(pedidoIdAtual);
  } catch (err) {
    console.error("Erro ao criar embalagem:", err);
    mostrarAviso("❌ Erro ao criar embalagens", "#e74c3c");
  }
  await carregarEmbalagens(pedidoIdAtual);
}

function carregarPreparacao(pedidoId, numeroPedido) {
  document.getElementById("tituloPedidoPreparacao").textContent = numeroPedido;
  mostrarTela('telaPreparacao');

  // Buscar SKUs
  fetch(`/itens/${pedidoId}`)
    .then(res => res.json())
    .then(itens => {
      const separados = itens.filter(i => i.status === "separado");
      const preparados = itens.filter(i => i.status === "preparado");

      renderizarSkusSeparados(separados, pedidoId);
      renderizarSkusPreparados(preparados);
    });

  // Buscar embalagens (blisters e caixas)
  fetch(`/embalagens/${pedidoId}`)
    .then(res => res.json())
    .then(embalagens => {
      renderizarEmbalagens(embalagens);
    });
}

function renderizarSkusSeparados(lista, pedidoId) {
  const area = document.getElementById("listaSeparados");
  area.innerHTML = "";
  
  lista.forEach(item => {
    const div = document.createElement("div");
    div.className = "card-separado";
    div.innerHTML = `
      <strong>${item.hardware}</strong><br>
      <strong>${item.sku}</strong> - ${item.qtd} un.<br>
      <em>${item.modelo}</em><br>
      <button onclick="adicionarAoBlister(${item.id}, '${item.hardware}', ${item.qtd}, ${pedidoId})">Adicionar</button>
    `;
    area.appendChild(div);
  });
}

async function adicionarABlister(itemId, blisterId, qtd) {
  try {
    // 1. Atualiza o item para "preparado" (PUT HTTP)
    await fetch(`https://10.10.2.94:5501/itens/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "preparado" })
    });

    // 2. Atualiza o status do blister (para 'fechado' se estiver cheio)
    const novoStatus = qtd >= 25 ? "fechado" : "aberto";
    await fetch(`https://10.10.2.94:5501/embalagens/${blisterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus })
    });

    // 3. Recarrega os dados
    await carregarSkusSeparados();
    await carregarEmbalagens();
    mostrarAviso("✅ Item adicionado com sucesso!", "#2ecc71");

  } catch (error) {
    console.error("Erro:", error);
    mostrarAviso(`❌ Falha: ${error.message}`, "#e74c3c");
  }
}

function iniciarPreparacao(id, numeroPedido) {
  pedidoIdAtual = id;
  pedidoAtual = numeroPedido;
  document.getElementById("tituloPedidoPreparacao").textContent = numeroPedido;
  mostrarTela("telaPreparacao");
  carregarSkusSeparados(); // <-- Corrigido aqui
  carregarEmbalagens(pedidoIdAtual);
}

function adicionarAoBlister(itemId, hardware, qtd, pedidoId) {
  if (hardware === "Processador") {
    const caixas = prompt("Quantas caixas deseja adicionar?");
    if (!caixas || isNaN(caixas)) return;
    
    fetch(`/embalagens/adicionar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedido_id: pedidoId,
        item_id: itemId,
        tipo: "caixa",
        quantidade: caixas
      })
    }).then(() => carregarPreparacao(pedidoId, pedidoAtual));
  } else {
    // Adiciona automático em blister
    fetch(`/embalagens/adicionar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedido_id: pedidoId,
        item_id: itemId,
        tipo: "blister"
      })
    }).then(() => carregarPreparacao(pedidoId, pedidoAtual));
  }
}


function voltarParaEstoqueStatus(idPedido) {
  fetch(`https://10.10.2.94:5501/pedidos/${idPedido}/voltar`, {
    method: "PUT"
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        mostrarAviso("Pedido retornado ao Estoque.", "#27ae60");
        carregarPedidosExpedicao(); // Atualiza a lista
      } else {
        throw new Error();
      }
    })
    .catch(err => {
      console.error("Erro ao mover pedido de volta ao estoque:", err);
      mostrarAviso("❌ Erro ao retornar pedido.", "#e74c3c");
    });
}

// Carrega pedidos do banco de dados
async function atualizarHistoricoDoBanco() {
  try {
    const response = await fetch("https://10.10.2.94:5501/pedidos");

    if (!response.ok) {
      throw new Error("Erro ao buscar pedidos do banco de dados.");
    }

    const listaDoBanco = await response.json();

    // Transforma a lista em objeto indexado pelo nome do pedido
    const pedidosFormatados = {};
    listaDoBanco.forEach((p) => {
      pedidosFormatados[p.pedido] = {
        id: p.id,
        inicio: p.inicio,
        fim: p.fim,
        skus: p.skus || [],
      };
    });

    // Atualiza as variáveis globais e o localStorage
    pedidos = pedidosFormatados;
    localStorage.setItem("pedidosRAM", JSON.stringify(pedidosFormatados));

    mostrarHistorico();
  } catch (erro) {
    console.error("Erro ao atualizar histórico:", erro);
    mostrarAviso(
      "❌ Não foi possível atualizar o histórico do banco.",
      "#e74c3c"
    );
  }
}

function abrirModalNovoPedido() {
  document.getElementById("modalNovoPedido").classList.remove("hidden");
  tipoSelecionado = "";
  document.getElementById("confirmarPedido").disabled = true;

  // Limpar campos e seleção
  document.getElementById("pedidoInput").value = "";
  document.querySelectorAll(".tipo-buttons button").forEach((btn) => {
    btn.classList.remove("selecionado");
  });
}
function fecharModalNovoPedido() {
  document.getElementById("modalNovoPedido").classList.add("hidden");
}

function selecionarTipo(tipo) {
  tipoSelecionado = tipo;
  document.getElementById("confirmarPedido").disabled = false;

  // Atualizar visual
  document.querySelectorAll(".tipo-buttons button").forEach((btn) => {
    btn.classList.remove("selecionado");
  });
  document
    .getElementById(`btn${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`)
    .classList.add("selecionado");
}

function continuarPedido(pedido, id, tipo) {
  fetch(`https://10.10.2.94:5501/pedidos/${id}`)
    .then(res => res.json())
    .then(data => {
      // Atualiza variáveis globais
      pedidoAtual = pedido;
      pedidoIdAtual = id;

      // Restaura localStorage se desejar persistência
      pedidos[pedido] = {
        id,
        tipo,
        inicio: data.inicio,
        skus: data.itens || []
      };
      localStorage.setItem("pedidoAtual", pedido);
      localStorage.setItem("pedidoIdAtual", id);
      localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));

      // Atualiza UI
      mostrarTela('telaPedido');
      document.getElementById("resumoPedido").innerText = `Pedido ${pedido}`;

      // Reexibe os SKUs antigos
      atualizarInterface();
    })
    .catch(err => {
      console.error("Erro ao continuar pedido:", err);
      mostrarAviso("❌ Erro ao recuperar pedido.", "#e74c3c");
    });
}

function confirmarNovoPedido() {
  const pedido = document.getElementById("pedidoInput").value.trim();
  if (!pedido) {
    alert("Digite o número do pedido.");
    return;
  }

  document.getElementById("modalNovoPedido").classList.add("hidden");

  const inicio = new Date().toISOString().slice(0, 19).replace("T", " ");

  fetch("https://10.10.2.94:5501/iniciar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedido, inicio, tipo: tipoSelecionado }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const erroTexto = await res.text();
        throw new Error(erroTexto);
      }
      return res.json();
    })

    .then((data) => {
      if (!data.success) throw new Error("Erro no backend");

      pedidoAtual = pedido;
      pedidoIdAtual = data.id;
      pedidos[pedido] = {
        id: data.id,
        skus: [],
        tipo: tipoSelecionado,
        inicio,
      };

      localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));
      localStorage.setItem("pedidoAtual", pedidoAtual);
      localStorage.setItem("pedidoIdAtual", pedidoIdAtual);

      // Mostrar tela de adicionar SKUs
      mostrarTela('telaPedido');
      document.getElementById("resumoPedido").innerText = `Pedido ${pedido}`;

      mostrarAviso(`✅ Pedido ${pedido} criado com sucesso.`, "#2ecc71");
    })
    .catch((err) => {
      console.error("Erro ao criar pedido:", err);
      mostrarAviso("❌ Erro ao criar pedido.", "#e74c3c");
    });
}

function cancelarPedido(id) {
  if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;

  fetch(`https://10.10.2.94:5501/pedidos/${id}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao cancelar");
      carregarPedidosEstoque(); // atualiza lista
      mostrarAviso("Pedido cancelado com sucesso.", "#e67e22");
    })
    .catch((err) => {
      console.error(err);
      mostrarAviso("Erro ao cancelar pedido.", "#e74c3c");
    });
}

function mostrarAviso(mensagem, cor = "#333") {
  const aviso = document.getElementById("avisoDinamico");
  aviso.textContent = mensagem;
  aviso.style.backgroundColor = cor;
  aviso.classList.remove("hidden");

  setTimeout(() => {
    aviso.classList.add("hidden");
  }, 3000); // some após 3 segundos
}
function iniciarPedido() {
  const pedido = document.getElementById("pedido").value.trim();
  if (!pedido) {
    mostrarAviso("⚠️ Pedido não pode ser vazio.", "#e74c3c");
    return;
  }
  if (pedidos[pedido]) {
    mostrarAviso(`⚠️ Pedido ${pedido} já existe.`, "#e74c3c");
    return;
  }

  const inicio = new Date().toISOString().slice(0, 19).replace("T", " ");

  console.trace("Chamando iniciarPedido");
  fetch("https://10.10.2.94:5501/iniciar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pedido, inicio }),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error("Erro ao iniciar pedido.");
      }
      return res.json();
    })
    .then((data) => {
      console.log("Pedido iniciado:", data);
      pedidoIdAtual = data.id;
      const id = data.id || pedidoIdAtual; // Garante que o ID seja usado corretamente
      // const id = data.id;
      pedidoAtual = pedido;

      console.log("Pedido iniciado:", pedido, "ID:", pedidoIdAtual);

      pedidos[pedido] = {
        id,
        skus: [],
        inicio,
      };

      localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));
      localStorage.setItem("pedidoAtual", pedidoAtual);
      localStorage.setItem("pedidoIdAtual", pedidoIdAtual);

      document.getElementById("telaInicio").classList.add("hidden");
      document.getElementById("telaPedido").classList.remove("hidden");
      document.getElementById("resumoPedido").innerText = `Pedido ${pedido}`;

      mostrarAviso(`✅ Pedido ${pedido} iniciado com sucesso!`, "#2ecc71");
    })
    .catch((err) => {
      console.error("Erro ao iniciar pedido:", err);
      mostrarAviso("❌ Erro ao iniciar pedido.", "#e74c3c");
    });
}
function validarSKU(sku) {
  if (!sku.startsWith("PC")) {
    mostrarAviso("SKU deve começar com 'PC'.", "#e74c3c");
    return false;
  }
  const numeroParte = sku.slice(2);
  if (!/^\d+$/.test(numeroParte)) {
    mostrarAviso("SKU deve conter apenas números após 'PC'.", "#e74c3c");
    return false;
  }
  return true;
}
function adicionarSKU() {
  let rawSku = document.getElementById("sku").value.trim();
  const sku = `PC${rawSku}`;
  if (!validarSKU(sku)) return;

  const dissipador = document.getElementById("dissipador").checked;
  const porBlister = dissipador ? 22 : 25;
  const qtdItem = parseInt(document.getElementById("qtdItem").value);

  if (isNaN(qtdItem) || qtdItem <= 0) {
    mostrarAviso("Quantidade inválida.", "#e74c3c");
    return;
  }

  const infoSku = skuData.find(item => item.SKU.toUpperCase() === sku.toUpperCase());
  const hardware = infoSku ? infoSku.hardware : "Não preenchido";
  const modelo = infoSku ? infoSku.modelo : "Não preenchido";

  const payload = {
    pedido_id: pedidoIdAtual,
    sku,
    qtd: qtdItem,
    hardware,
    modelo
  };

  fetch("https://10.10.2.94:5501/itens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error();
      mostrarAviso("✅ SKU adicionado.", "#2ecc71");

      if (hardware === "Não preenchido") {
        mostrarAviso("⚠️ SKU adicionado sem modelo. Cadastre no gerenciador de SKUs.", "#f39c12");
      }

      // Atualiza a tela com base no banco
      consultarSkusSeparados();
      atualizarInterface();

    })
    .catch(err => {
      console.error("Erro ao salvar SKU no banco:", err);
      mostrarAviso("❌ Erro ao salvar SKU no banco.", "#e74c3c");
    });

  // Limpa campos
  document.getElementById("sku").value = "";
  document.getElementById("qtdItem").value = "";
  document.getElementById("dissipador").checked = false;
}

function atualizarInterface() {
    if (!pedidoIdAtual) return;

  fetch(`https://10.10.2.94:5501/itens/${pedidoIdAtual}`)
    .then(res => {
      if (!res.ok) {
        console.warn("❌ Resposta HTTP inválida:", res.status);
        throw new Error("Resposta HTTP inválida");
      }
      return res.json();
    })
    .then(itens => {
      if (!Array.isArray(itens)) {
        console.warn("❌ Dados malformados:", itens);
        return;
      }

      const resumo = document.getElementById("resumoPedido");
      if (!resumo) return;

      let totalMemorias = 0;
      let totalProcessadores = 0;

      itens.forEach(item => {
        if (item.hardware === "Memória RAM") totalMemorias += item.qtd;
        if (item.hardware === "Processador") totalProcessadores += item.qtd;
      });

      const totalItens = totalMemorias + totalProcessadores;
      const totalBlisters = Math.ceil(totalMemorias / 25);
      const totalCaixas = totalProcessadores;

      resumo.innerHTML = `
        <h3 class="resumo-titulo">Pedido ${pedidoAtual} ID: ${pedidoIdAtual}</h3>
        <div class="resumo-estoque">
            <div class="resumo-memoria">
              <strong>Memórias:</strong> ${totalMemorias}<br>
            </div>
            <div class="resumo-processador">
              <strong>Processadores:</strong> ${totalProcessadores}<br>
            </div>
        </div>
        <div class="resumo-itens-wrapper">
            <div class="resumo-itens">
              <strong>Total de Itens:</strong> ${totalItens}
            </div>
        </div>
      `;
    })
    .catch(err => {
      console.error("Erro ao atualizar resumo:", err);
      const resumo = document.getElementById("resumoPedido");
      if (resumo) {
        resumo.innerHTML = `<p style="color: red;">❌ Falha ao carregar resumo do pedido.</p>`;
      }
    });
    consultarSkusSeparados();
}

function consultarSkusSeparados() {
  fetch(`https://10.10.2.94:5501/itens/${pedidoIdAtual}`)
    .then(res => res.json())
    .then(itens => {
      const area = document.getElementById("listaSkusSeparados");
      area.innerHTML = "";

      if (itens.length === 0) {
        area.innerHTML = "<p>Nenhum SKU separado ainda.</p>";
        return;
      }

      itens.forEach((item) => {
        const div = document.createElement("div");
div.className = "card-sku"; // novo nome da classe para evitar conflito

// Define o ícone com base no hardware
const icone = item.hardware === "Processador" ? "cpu.png" : "ram.png";

div.innerHTML = `
  <div class="card-sku-topo">
    <img src="icon/${icone}" class="icone-hardware" alt="Icone ${item.hardware}">
    <span class="hardware-nome">${item.hardware}</span>
  </div>
  <div class="card-sku-info">
  <div><strong>${item.sku}</strong> - ${item.qtd} un.</div>
  <em class="card-modelo">${item.modelo}</em>
  <div><strong>Status:</strong> ${item.status}</div>
</div>
  <button class="btn-remover-sku" onclick="removerSku(${item.id})">Remover SKU</button>
`;

area.appendChild(div);

      });
    })
    .catch(err => {
      console.error("Erro ao buscar SKUs:", err);
      mostrarAviso("❌ Erro ao buscar SKUs.", "#e74c3c");
    });
}
function removerSku(id) {
  if (!confirm("Tem certeza que deseja remover este SKU?")) return;

  fetch(`https://10.10.2.94:5501/itens/${id}`, {
    method: "DELETE"
  })
  .then(res => {
    if (!res.ok) throw new Error();
    consultarSkusSeparados();
    atualizarInterface();
    mostrarAviso("✅ SKU removido.", "#2ecc71");
  })
  
  .catch(err => {
    console.error("Erro ao deletar SKU:", err);
    mostrarAviso("❌ Erro ao remover SKU.", "#e74c3c");
  });
}


function removerSKU(index) {
  pedidos[pedidoAtual].skus.splice(index, 1);
  atualizarInterface();
}
// Finalizar pedido
async function enviarPedido() {
  try {
    const res = await fetch(`${API_URL}/itens/${pedidoIdAtual}`);
    const itens = await res.json();

    let qtd_memoria = 0;
    let qtd_processador = 0;

    itens.forEach(i => {
      if (i.hardware === "Memória RAM") qtd_memoria += i.qtd;
      if (i.hardware === "Processador") qtd_processador += i.qtd;
    });

    const resp = await fetch(`${API_URL}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedidoId: pedidoIdAtual,
        qtd_memoria,
        qtd_processador
      })
    });

    const data = await resp.json();

    if (data.success) {
      mostrarAviso("✅ Pedido enviado para expedição!", "#2ecc71");

      delete pedidos[pedidoAtual];
      localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));

      mostrarTela('telaEstoque');
    } else {
      mostrarAviso("❌ Falha ao enviar pedido.", "#e74c3c");
    }
  } catch (err) {
    console.error("Erro ao enviar pedido:", err);
    mostrarAviso("❌ Erro ao enviar pedido.", "#e74c3c");
  }
}

function mostrarHistorico() {
  mostrarTela('telaHistorico');

  historicoPaginaAtual = 1;
  carregarHistoricoPaginado();
}
function carregarHistoricoPaginado() {
  const container = document.getElementById("historicoContainer");
  container.innerHTML = "";

  const filtro = document
    .getElementById("pesquisaHistorico")
    .value.toLowerCase();
  const listaPedidos = Object.entries(pedidos).filter(([pedido, _dados]) =>
    pedido.toLowerCase().includes(filtro)
  );

  // ⬅️ Aqui está o cálculo correto de total de páginas
  historicoTotalPaginas = Math.ceil(
    listaPedidos.length / historicoItensPorPagina
  );
  if (historicoTotalPaginas === 0) historicoTotalPaginas = 1;
  if (historicoPaginaAtual > historicoTotalPaginas)
    historicoPaginaAtual = historicoTotalPaginas;

  const inicio = (historicoPaginaAtual - 1) * historicoItensPorPagina;
  const fim = inicio + historicoItensPorPagina;
  const pedidosPagina = listaPedidos.slice(inicio, fim);

  pedidosPagina.forEach(([pedido, pedidoData]) => {
    let totalMemorias = 0;
    let totalBlisters = 0;
    let totalProcessadores = 0;
    let totalCaixas = 0;

    pedidoData.skus.forEach((item) => {
      if (item.hardware === "Processador") {
        totalProcessadores += item.qtdProcessadores || 0;
        totalCaixas += item.qtdCaixas || 0;
      } else {
        totalMemorias += item.qtdMemorias || 0;
        totalBlisters += item.qtdBlisters || 0;
      }
    });

    const totalItens = totalMemorias + totalProcessadores;

    const pedidoDiv = document.createElement("div");
    pedidoDiv.className = "pedido-container";

    let blocosResumoHTML = '<div class="resumo-blocos">';
    if (totalMemorias > 0 || totalBlisters > 0) {
      blocosResumoHTML += `
        <div class="bloco-memoria">
          <strong>Memória(s):</strong> ${totalMemorias}<br>
          <strong>Blister(s):</strong> ${totalBlisters}
        </div>`;
    }
    if (totalProcessadores > 0 || totalCaixas > 0) {
      blocosResumoHTML += `
        <div class="bloco-processador">
          <strong>Processador(es):</strong> ${totalProcessadores}<br>
          <strong>Caixa(s):</strong> ${totalCaixas}
        </div>`;
    }
    blocosResumoHTML += "</div>";

    pedidoDiv.innerHTML = `
      <h4 class="pedido-titulo">Pedido ${pedido}</h4>
      ${blocosResumoHTML}
      <div class="total-itens-container">
        <div class="total-itens-bloco">
          <strong>Total de Itens:</strong> ${totalItens}
        </div>
        <button class="toggle-skus-btn" onclick="toggleSKUs(this)">☰</button>
      </div>
      <div class="skus-container hidden">
        ${pedidoData.skus
        .map(
          (item) => `
          <div class="sku-card">
            <strong>SKU:</strong> ${item.sku}<br>
            <strong>${item.hardware}</strong> - ${item.modelo}<br>
            ${item.hardware === "Processador"
              ? `<strong>Quantidade:</strong> ${item.qtdProcessadores || 0
              }<br>
                 <strong>Caixa(s):</strong> ${item.qtdCaixas || 0}`
              : `<strong>Quantidade:</strong> ${item.qtdMemorias || 0}<br>
                 <strong>Blister(s):</strong> ${item.qtdBlisters || 0}`
            }
          </div>
        `
        )
        .join("")}
      </div>
      <div class="pedido-botoes">
        <button onclick="gerarPDF('${pedido}')" class="btn-imprimir">🖨️ Imprimir</button>
        <button onclick="excluirPedido('${pedido}')" class="btn-excluir">🗑️ Excluir</button>
      </div>
    `;

    container.appendChild(pedidoDiv);
  });

  atualizarControlesPaginacaoHistorico();
}

function atualizarControlesPaginacaoHistorico() {
  const paginacao = document.getElementById("paginacaoHistorico");
  paginacao.innerHTML = `
    <button onclick="paginaAnteriorHistorico()" ${historicoPaginaAtual === 1 ? "disabled" : ""
    }>⬅️ Anterior</button>
    <span>${historicoPaginaAtual} / ${historicoTotalPaginas}</span>
    <button onclick="proximaPaginaHistorico()" ${historicoPaginaAtual === historicoTotalPaginas ? "disabled" : ""
    }>Próxima ➡️</button>
  `;
}
function paginaAnteriorHistorico() {
  if (historicoPaginaAtual > 1) {
    historicoPaginaAtual--;
    carregarHistoricoPaginado();
  }
}
function proximaPaginaHistorico() {
  if (historicoPaginaAtual < historicoTotalPaginas) {
    historicoPaginaAtual++;
    carregarHistoricoPaginado();
  }
}
function toggleSKUs(button) {
  const skusContainer = button
    .closest(".pedido-container")
    .querySelector(".skus-container");
  skusContainer.classList.toggle("hidden");
}
function excluirPedido(pedido) {
  const pin = prompt("Digite o PIN para excluir:");
  if (pin === "3301") {
    delete pedidos[pedido];
    localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));
    mostrarHistorico();
    mostrarAviso(`🗑️ Pedido ${pedido} excluído.`, "#e74c3c");
  } else {
    alert("PIN incorreto.");
  }
  mostrarAviso(`🗑️ Pedido ${pedido} excluído.`, "#e74c3c");
}
function gerarPDF(pedido) {
  const doc = new jsPDF();
  const pedidoData = pedidos[pedido];

  // Cabeçalho
  doc.setFillColor(50);
  doc.rect(0, 0, 210, 20, "F");
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.text(`Relatório do Pedido ${pedido}`, 10, 13);

  let y = 30;
  const cardWidth = 180;
  const cardHeight = 35;
  const spacing = 10;

  let totalItens = 0;

  // Cards individuais
  pedidoData.skus.forEach((item) => {
    if (y + cardHeight > 270) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(245);
    doc.roundedRect(15, y, cardWidth, cardHeight, 3, 3, "F");

    doc.setFontSize(9);
    doc.setTextColor(0);

    const modeloLines = doc.splitTextToSize(item.modelo, 90);

    doc.text(`SKU: ${item.sku}`, 18, y + 7);
    doc.text(`Hardware: ${item.hardware}`, 18, y + 14);
    doc.text(`Modelo:`, 18, y + 21);
    doc.text(modeloLines, 38, y + 21);

    const isProc = item.hardware === "Processador";
    const qtdTotal = isProc
      ? item.qtd || item.qtdProcessadores || 0
      : item.qtdMemorias || item.qtd || 0;
    const qtdBlisterOuCaixa = isProc
      ? item.qtdCaixas || 0
      : item.qtdBlisters || 0;
    const label = isProc ? "Caixas" : "Blisters";

    totalItens += qtdTotal;

    doc.text(`${label}: ${qtdBlisterOuCaixa}`, 130, y + 14);
    doc.text(`Qtd.: ${qtdTotal}`, 130, y + 21);

    y += cardHeight + spacing;
  });

  // Total de itens
  if (y + 20 > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFillColor(230);
  doc.roundedRect(15, y, cardWidth, 20, 3, 3, "F");
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(`Total de Itens do Pedido: ${totalItens}`, 20, y + 13);

  // Página da planilha
  doc.addPage();
  doc.setFontSize(10);
  doc.setTextColor(0);

  // Cabeçalho da planilha
  const startX = 10;
  let rowY = 20;
  const colWidths = [30, 30, 60, 40, 30];

  doc.setFillColor(200);
  doc.rect(startX, rowY, 190, 10, "F");
  doc.setTextColor(0);
  doc.text("SKU", startX + 2, rowY + 7);
  doc.text("Hardware", startX + colWidths[0] + 2, rowY + 7);
  doc.text("Modelo", startX + colWidths[0] + colWidths[1] + 2, rowY + 7);
  doc.text(
    "Blisters/Caixas",
    startX + colWidths[0] + colWidths[1] + colWidths[2] + 2,
    rowY + 7
  );
  doc.text(
    "Qtd.",
    startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2,
    rowY + 7
  );

  rowY += 10;

  pedidoData.skus.forEach((item) => {
    if (rowY + 10 > 280) return; // evita ultrapassar a página

    const isProc = item.hardware === "Processador";
    const qtd = isProc
      ? item.qtd || item.qtdProcessadores || 0
      : item.qtdMemorias || item.qtd || 0;
    const caixasOuBlisters = isProc
      ? item.qtdCaixas || 0
      : item.qtdBlisters || 0;
    const modeloLines = doc.splitTextToSize(item.modelo, colWidths[2] - 4);

    // Celulas da linha
    doc.setDrawColor(150);
    doc.setFillColor(255);

    // Coluna SKU
    doc.rect(startX, rowY, colWidths[0], 10, "S");
    doc.text(item.sku, startX + 2, rowY + 7);

    // Coluna Hardware
    doc.rect(startX + colWidths[0], rowY, colWidths[1], 10, "S");
    doc.text(item.hardware, startX + colWidths[0] + 2, rowY + 7);

    // Coluna Modelo
    doc.rect(startX + colWidths[0] + colWidths[1], rowY, colWidths[2], 10, "S");
    doc.text(modeloLines, startX + colWidths[0] + colWidths[1] + 2, rowY + 4);

    // Coluna Blisters/Caixas
    doc.rect(
      startX + colWidths[0] + colWidths[1] + colWidths[2],
      rowY,
      colWidths[3],
      10,
      "S"
    );
    doc.text(
      `${isProc ? "Caixas" : "Blisters"}: ${caixasOuBlisters}`,
      startX + colWidths[0] + colWidths[1] + colWidths[2] + 2,
      rowY + 7
    );

    // Coluna Qtd
    doc.rect(
      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
      rowY,
      colWidths[4],
      10,
      "S"
    );
    doc.text(
      `${qtd}`,
      startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2,
      rowY + 7
    );

    rowY += 10;
  });

  doc.save(`pedido_${pedido}.pdf`);
}



document.getElementById("sku").addEventListener("input", function () {
  const valor = this.value.trim();
  const codigoCompleto = "PC" + valor;
  const encontrado = listaCompletaSKUs.find(
    (item) => item.SKU === codigoCompleto
  );

  if (encontrado) {
    const hardware = encontrado.hardware;
    const modelo = encontrado.modelo;
  } else {
    const hardware = "Não encontrado";
    const modelo = "Não encontrado";
  }
});
function atualizarResumoPedido() {
  const resumoContainer = document.getElementById("resumoPedido");
  if (!resumoContainer || pedidoAtual.skus.length === 0) {
    resumoContainer.innerHTML = "";
    return;
  }

  let totalMemorias = 0,
    totalBlisters = 0,
    totalProcessadores = 0,
    totalCaixas = 0;

  pedidoAtual.skus.forEach((sku) => {
    if (sku.hardware === "Memória RAM") {
      totalMemorias += sku.quantidade;
      totalBlisters += 1;
    } else if (sku.hardware === "Processador") {
      totalProcessadores += sku.quantidade;
      totalCaixas += 1;
    }
  });

  const totalItens = totalMemorias + totalProcessadores;

  resumoContainer.innerHTML = `
          <div class="card-resumo">
            <h3><img src="ram.png" width="24"> Memórias</h3>
            <p>Total: ${totalMemorias} módulos</p>
            <p>Blisters: ${totalBlisters}</p>
          </div>
          <div class="card-resumo">
            <h3><img src="cpu.png" width="24"> Processadores</h3>
            <p>Total: ${totalProcessadores} unidades</p>
            <p>Caixas: ${totalCaixas}</p>
          </div>
          <div class="card-resumo destaque">
            <h3>Total de Itens</h3>
            <p>${totalItens}</p>
          </div>
        `;
}
function pesquisarSKU() {
  const skuInput = document.getElementById("sku").value.trim().toUpperCase();
  const inputModelo = document.getElementById("skuModelo");

  if (!skuInput) {
    alert("Digite um SKU para pesquisar.");
    return;
  }

  const dadosSKU = skusJson.find((item) => item.SKU.toUpperCase() === skuInput);

  if (dadosSKU) {
    inputModelo.value = dadosSKU.modelo;
  } else {
    alert("SKU não encontrado.");
    inputModelo.value = ""; // limpa o campo se não encontrar
  }
}
// Tela de SKUs
let itensPorPagina = 10;
let paginaAtual = 1;
let listaCompletaSkus = [];
let listaFiltradaSkus = [];
let skusPendentes = [];

function carregarSKUs() {
  fetch("https://10.10.2.94:5501/skus")
    .then((res) => res.json())
    .then((data) => {
      listaCompletaSkus = data;
      listaFiltradaSkus = [...data];
      paginaAtual = 1;
      renderizarTabela();
    });
}

function renderizarTabela() {
  const tbody = document.getElementById("listaTabelaSkus");
  tbody.innerHTML = "";

  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const pagina = listaFiltradaSkus.slice(inicio, fim);

  for (const sku of pagina) {
    const linha = document.createElement("tr");

    const pendente = skusPendentes.some((p) => p.SKU === sku.SKU);

    linha.innerHTML = `
      <td>${sku.SKU}${pendente ? " 🕒" : ""}</td>
      <td>${sku.hardware}</td>
      <td>${sku.modelo}</td>
      <td>${pendente ? '<span style="color: #f39c12;">Pendente</span>' : ""
      }</td>
    `;

    if (pendente) {
      linha.style.backgroundColor = "#fff3cd"; // Amarelo claro
    }

    tbody.appendChild(linha);
  }

  // Atualiza paginação
  const totalPaginas = Math.ceil(listaFiltradaSkus.length / itensPorPagina);
  document.getElementById(
    "paginaAtual"
  ).textContent = `${paginaAtual} / ${totalPaginas}`;
  document.getElementById("btnAnterior").disabled = paginaAtual === 1;
  document.getElementById("btnProximo").disabled = paginaAtual === totalPaginas;
}

function paginaAnterior() {
  const totalPaginas = Math.ceil(listaFiltradaSkus.length / itensPorPagina);
  if (paginaAtual > 1) {
    paginaAtual--;
  } else {
    paginaAtual = totalPaginas; // volta para a última página
  }
  renderizarTabela();
}

function proximaPagina() {
  const totalPaginas = Math.ceil(listaFiltradaSkus.length / itensPorPagina);
  if (paginaAtual < totalPaginas) {
    paginaAtual++;
  } else {
    paginaAtual = 1; // volta para a primeira página
  }
  renderizarTabela();
}

function atualizarListaPendentes() {
  const ul = document.getElementById("listaPendentesUl");
  ul.innerHTML = "";

  if (skusPendentes.length === 0) {
    document.getElementById("listaPendentes").style.display = "none";
    return;
  }

  document.getElementById("listaPendentes").style.display = "block";

  for (const sku of skusPendentes) {
    const li = document.createElement("li");
    li.textContent = `${sku.SKU} - ${sku.hardware} - ${sku.modelo}`;
    ul.appendChild(li);
  }
}

function enviarSkusPendentes() {
  if (skusPendentes.length === 0) {
    alert("Nenhum SKU para enviar.");
    return;
  }

  fetch("https://10.10.2.94:5501/salvar-skus", {
    // <- Nome correto da rota que usa MySQL
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(skusPendentes), // <- Envia um único SKU, pois a rota salva um por vez
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao enviar SKU.");
      return res.text();
    })
    .then((msg) => {
      alert(msg);
      skusPendentes.shift(); // Remove o primeiro da fila
      mostrarSkusPendentes();
    })
    .catch((err) => {
      console.error(err);
      alert("Erro ao salvar SKU: " + err.message);
    });

  mostrarAviso("✅ SKUs pendentes enviados com sucesso!", "#2ecc71");
  atualizarListaPendentes(); // Atualiza a lista pendente
  renderizarTabela(); // Atualiza a tabela após enviar
}

function mostrarSkusPendentes() {
  const container = document.getElementById("skusPendentes");
  container.innerHTML = "";

  if (skusPendentes.length === 0) {
    container.innerHTML = "<i>Nenhum SKU pendente para adicionar.</i>";
    return;
  }

  skusPendentes.forEach((sku, i) => {
    const div = document.createElement("div");
    div.textContent = `${sku.SKU} - ${sku.hardware} - ${sku.modelo} `;
    // Botão para remover pendente
    const btnRemover = document.createElement("button");
    btnRemover.textContent = "❌";
    btnRemover.onclick = () => {
      skusPendentes.splice(i, 1);
      mostrarSkusPendentes();
    };
    div.appendChild(btnRemover);
    container.appendChild(div);
  });
}

function adicionarSkuPendente() {
  const codigo = document.getElementById("novoSkuCodigo").value.trim();
  const hardware = document.getElementById("novoSkuHardware").value;
  const modelo = document.getElementById("novoSkuModelo").value.trim();

  // Validação básica
  if (!codigo || !modelo) {
    alert("Preencha todos os campos");
    return;
  }

  // Evita duplicados no pendentes
  if (skusPendentes.some((sku) => sku.SKU === codigo)) {
    alert("SKU já adicionado nos pendentes!");
    return;
  }

  // Adiciona ao array
  skusPendentes.push({ SKU: codigo, hardware, modelo });

  // Atualiza visual na tela dos pendentes
  mostrarSkusPendentes();

  // Limpa campos
  document.getElementById("novoSkuCodigo").value = "";
  document.getElementById("novoSkuModelo").value = "";
}

function filtrarTabelaSkus() {
  const termo = document.getElementById("pesquisaSku").value.toLowerCase();
  listaFiltradaSkus = listaCompletaSkus.filter(
    (sku) =>
      sku.SKU.toLowerCase().includes(termo) ||
      sku.modelo.toLowerCase().includes(termo)
  );
  paginaAtual = 1;
  renderizarTabela();
}

async function excluirSKU(index) {
  const sku = listaFiltradaSkus[index];
  if (!confirm(`Tem certeza que deseja excluir o SKU ${sku.SKU}?`)) return;

  try {
    const response = await fetch(
      `/api/excluir-sku/${encodeURIComponent(sku.SKU)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      // tenta ler mensagem de erro do corpo
      const errorText = await response.text();
      throw new Error(errorText || "Erro desconhecido ao excluir SKU");
    }

    const msg = await response.text();
    alert(msg);
    await carregarSKUs(); // recarrega lista do servidor após exclusão
    atualizarLista();
  } catch (err) {
    console.error("Erro ao excluir SKU:", err);
    mostrarAviso("❌ Erro ao excluir SKU: " + err.message, "#e74c3c");
  }
}

function salvarSKUs() {
  const skusCustomizados = JSON.parse(
    localStorage.getItem("skusCustomizados") || "[]"
  );

  if (!skusCustomizados.length) {
    mostrarAviso("⚠️ Nenhum SKU personalizado para salvar.", "#f39c12");
    return;
  }

  fetch("/salvar-skus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skusCustomizados),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao salvar SKUs.");
      return res.text();
    })
    .then(() => {
      mostrarAviso("✅ SKUs salvos no servidor com sucesso!", "#2ecc71");
      localStorage.removeItem("skusCustomizados");
      carregarSKUs();
    })
    .catch((err) => {
      mostrarAviso("❌ Falha ao salvar SKUs.", "#e74c3c");
      console.error(err);
    });
}

document.addEventListener("DOMContentLoaded", carregarPedidosEstoque);
