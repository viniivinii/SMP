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

let itensPorPagina = 10;
let paginaAtual = 1;
let listaCompletaSkus = [];
let listaFiltradaSkus = [];
let skusPendentes = [];

let blistersAbertos = [];
let caixasAbertas = [];

let historicoPaginaAtual = 1;
let historicoItensPorPagina = 5;
let historicoTotalPaginas = 1;

let tipoSelecionado = null;

let dadosSeparados = [];
let dadosPreparados = [];
let dadosEmbalagens = [];
let skusPorEmbalagem = {};
let filtroStatusEmbalagem = 'todas';

let filtroSeparados = '';
let ordemSeparados = null;

let paginaSeparados = 1;
let paginaPreparados = 1;
let paginaEmbalagens = 1;

const itensPorPaginaPreparacao = 4;
const itensPorPaginaPreparados = 10;

let indiceExcluir = null;

function skuPossuiDissipador(codigo) {
  const info = skuData.find(
    (s) => s.SKU.toUpperCase() === codigo.toUpperCase()
  );
  if (!info) return false;
  return (
    Boolean(info.temDissipador) ||
    (info.modelo && info.modelo.toLowerCase().includes("dissipador"))
  );
}
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnConfirmarExcluir');
  if (btn) btn.addEventListener('click', confirmarExcluirSku);
  carregarSKUsDoBanco();
  carregarSKUs();
});
window.onload = () => {
  mostrarTela('telaEstoque');
};

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

    // Destaca botão ativo
  document.querySelectorAll('.btnTopo').forEach(b => b.classList.remove('ativo'));
  const mapa = {
    telaEstoque: 'btnEstoque',
    telaExpedicao: 'btnExpedicao',
    telaHistorico: 'btnHistorico',
    telaSkus: 'btnNovoSKU'
  };
  const botao = document.getElementById(mapa[idTela]);
  if (botao) botao.classList.add('ativo');
  
  // Chamada de funções de carregamento específicas para cada tela
  switch (idTela) {
    case "telaEstoque":
      carregarPedidosEstoque(); // ESSA FUNÇÃO PREENCHE #listaPedidosEstoque
      break;
    case "telaExpedicao":
      carregarPedidosExpedicao();
      break;
    case "telaHistorico":
      // carregarHistoricoPaginado();
      break;
    case "telaSkus":
      carregarSKUsDoBanco();
      break;
  }
}
async function carregarSKUsDoBanco() {
  try {
    const response = await fetch(`${API_URL}/skus`);
    if (!response.ok) throw new Error("Erro ao buscar SKUs");
    skuData = await response.json();
    console.log("SKUs carregados do banco:", skuData);
  } catch (error) {
    console.error("Erro ao carregar SKUs:", error);
    mostrarAviso("❌ Erro ao carregar SKUs do banco.", "#e74c3c");
  }
}
function carregarPedidosEstoque() {
  fetch(`${API_URL}/pedidos`)
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
  fetch(`${API_URL}/pedidosexp`)
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
          <strong>Enviado:</strong> ${p.inicio ? new Date(p.inicio).toLocaleDateString() : ''}<br>
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
    
    const response = await fetch(`${API_URL}/itens/${pedidoIdAtual}`);
    
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
    renderizarSkusPreparadosExpandido();

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

    dadosSeparados = [];
    dadosPreparados = [];
    atualizarBarraProgresso(0, 0);
    renderizarSeparadosPaginado();
    renderizarSkusPreparadosExpandido();

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

    const skusAgrupados = Object.entries(agrupados);
    const total = Math.ceil((skusAgrupados.length || 0) / itensPorPaginaPreparados) || 1;
    if (paginaPreparados > total) paginaPreparados = total;
    const inicio = (paginaPreparados - 1) * itensPorPaginaPreparados;
    const pagina = skusAgrupados.slice(inicio, inicio + itensPorPaginaPreparados);

    pagina.forEach(([sku, embalagens]) => {
      const card = document.createElement("div");
      card.className = "card-preparado";
      const totalQtd = embalagens.reduce((s, e) => s + e.qtd, 0);

      const listaOculta = embalagens.map(e =>
        `<li>${e.tipo.toUpperCase()} #${e.embalagem_id} - ${e.qtd} un</li>`
      ).join("");

      card.innerHTML = `       
          <div class="card-preparado-topo">
          <strong>${sku}</strong>
          <span class="qtd">${totalQtd} un</span>
        </div>
        <button class="btn-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">Ver embalagens</button>
        <ul class="lista-embalagens hidden">${listaOculta}</ul>       
      `;

      container.appendChild(card);
    });
    document.getElementById("paginaPreparados").textContent = `${paginaPreparados} / ${total}`;
    document.getElementById("btnPrepAnt").disabled = paginaPreparados === 1;
    document.getElementById("btnPrepProx").disabled = paginaPreparados === total;
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
      fetch(`${API_URL}/itens/${pedidoIdAtual}`).then(r => r.json()),
      fetch(`${API_URL}/embalagens/${pedidoIdAtual}`).then(r => r.json()),
    ]);

    let qtdMemorias = 0;
    let qtdProcessadores = 0;

    const itensSeparados = itens.filter(i => i.status === "separado");
    const itensPreparados = itens.filter(i => i.status === "preparado");
    
    const totalSeparados = itensSeparados.reduce((acc, i) => acc + i.qtd, 0);
    const totalItensPreparados = itensPreparados.reduce((acc, i) => acc + i.qtd, 0);

    itens.forEach(item => {
      if (item.hardware === "Memória RAM") qtdMemorias += item.qtd;
      if (item.hardware === "Processador") qtdProcessadores += item.qtd;
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
async function distribuirSkuParaBlisters(itemId, sku, qtd, hardware, dissipador) {
  try {
    // Checar se há embalagens do tipo blister abertas
    const resposta = await fetch(`${API_URL}/embalagens/${pedidoIdAtual}`);
    const embalagens = await resposta.json();
    const blistersAbertos = embalagens.filter(e => e.tipo === 'blister' && e.status === 'aberto');

    if (blistersAbertos.length === 0) {
      return mostrarAviso("⚠️ Nenhum blister aberto disponível. Crie uma embalagem primeiro.", "#f39c12");
    }

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
async function distribuirSkuParaCaixas(itemId, sku, qtd, hardware) {
  try {
    const resposta = await fetch(`${API_URL}/embalagens/${pedidoIdAtual}`);
    const embalagens = await resposta.json();
    const caixas = embalagens.filter(e => e.tipo === 'caixa' && e.status === 'aberto');

    if (caixas.length === 0) {
      return mostrarAviso("⚠️ Nenhuma caixa aberta disponível. Crie uma embalagem primeiro.", "#f39c12");
    }

    const distrib = await fetch(`${API_URL}/embalagens/distribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedido_id: pedidoIdAtual,
        item_id: itemId,
        sku,
        qtd,
        hardware
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

    await carregarSkusSeparados();
    await carregarEmbalagens(pedidoIdAtual);

  } catch (err) {
    console.error("Erro na distribuição:", err);
    mostrarAviso("❌ Falha ao distribuir SKU nas caixas", "#e74c3c");
  }
}
async function excluirEmbalagem(id) {
  try {
    await fetch(`${API_URL}/embalagens/${id}`, {
      method: "DELETE",
    });
    await carregarSkusSeparados();
    await carregarEmbalagens(pedidoIdAtual);
    renderizarSkusPreparadosExpandido();
  } catch (err) {
    console.error("Erro ao excluir embalagem:", err);
    mostrarAviso("❌ Erro ao excluir embalagem", "#e74c3c");
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
    renderizarSkusPreparadosExpandido();
    await carregarEmbalagens(pedidoIdAtual);

  } catch (err) {
    console.error("Erro ao alternar status do blister:", err);
    mostrarAviso("❌ Falha ao atualizar status da embalagem", "#e74c3c");
  }
}
function renderizarEmbalagensPaginado() {
  const lista = document.getElementById("listaEmbalagens");
  lista.innerHTML = "";

  const filtradas = dadosEmbalagens.filter(e => {
    if (filtroStatusEmbalagem === 'todas') return true;
    return e.status === filtroStatusEmbalagem;
  });

if (!filtradas || filtradas.length === 0) {
    lista.innerHTML = "<p>Nenhuma embalagem criada.</p>";
  } else {
    const inicio = (paginaEmbalagens - 1) * itensPorPaginaPreparacao;
    const pagina = filtradas.slice(inicio, inicio + itensPorPaginaPreparacao);

      pagina.forEach((emb) => {
      const div = document.createElement("div");
      div.className = `card-embalagem ${emb.status === "fechado" ? "fechado" : "aberto"}`;

      const ocup = emb.ocupado || 0;
      const capacidade = emb.tipo === 'caixa' ? 100 : (emb.capacidade || 25);
      const perc = Math.round((ocup / capacidade) * 100);
      const itens = skusPorEmbalagem[emb.id] || [];
      const listaOculta = itens.map(i => `<li>${i.sku} - ${i.qtd} un</li>`).join("") || "<li>Vazio</li>";


 div.innerHTML = `
        <div class="header-embalagem">
          <strong>${emb.tipo.toUpperCase()} #${emb.id}</strong>
          <span>${emb.status === "fechado" ? "🔒" : "🔓"}</span>
        </div>
        <div class="lotacao">
          <div class="barra-lotacao"><div style="width:${perc}%"></div></div>
          <span>${perc}%</span>
        </div>
        <button class="btn-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">Ver SKUs</button>
        <ul class="lista-embalagens hidden">${listaOculta}</ul>
        <div class="acoesBts">
          <button id="btnStatusBlister" data-status="${emb.status}" onclick="alternarStatusBlister(${emb.id}, '${emb.status}')">
            ${emb.status === "fechado" ? "🔓 Abrir" : "🔒 Fechar"}
          </button>
          ${emb.status === "aberto" ? `
            <div class="btnAcaoBts">
              <button id="btnAtribuirSku" onclick="abrirModalAddSku(${emb.id}, '${emb.tipo}', ${capacidade - ocup}, ${capacidade})">➕</button>
              <button id="btnExcluirEmb" onclick="excluirEmbalagem(${emb.id})">🗑️</button>
            </div>
            ` : ""}
        </div>
      `;
      lista.appendChild(div);
    });
  }

  const totalPag = Math.ceil((filtradas.length || 0) / itensPorPaginaPreparacao) || 1;
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
    barraSeparados.textContent = `${percSeparados}% Preparado`;
  }

  if (barraPreparados) {
    barraPreparados.style.width = `${percPreparados}%`;
    barraPreparados.textContent = `${percPreparados}% prontos`;
  }
  
  const btnFinalizar = document.getElementById("btnFinalizarPreparacao");
  if (btnFinalizar) {
    btnFinalizar.disabled = percPreparados < 100;
  }
}
function renderizarSeparadosPaginado() {
  const area = document.getElementById("listaSeparados");
  area.innerHTML = "";

   let lista = [...dadosSeparados];

  if (filtroSeparados) {
    const termo = filtroSeparados.toLowerCase();
    lista = lista.filter(i => i.sku.toLowerCase().includes(termo));
  }

  if (ordemSeparados === 'asc') {
    lista.sort((a, b) => a.qtd - b.qtd);
  } else if (ordemSeparados === 'desc') {
    lista.sort((a, b) => b.qtd - a.qtd);
  }

  if (lista.length === 0) {
    area.innerHTML = "<p class='aviso'>Nenhum SKU para preparar</p>";
  } else {
    const total = Math.ceil(lista.length / itensPorPaginaPreparacao) || 1;
    if (paginaSeparados > total) paginaSeparados = total;
    const inicio = (paginaSeparados - 1) * itensPorPaginaPreparacao;
    const pagina = lista.slice(inicio, inicio + itensPorPaginaPreparacao);

    pagina.forEach(item => {
      const card = document.createElement("div");
      card.className = "card-preparacao";
      const dissipador = Boolean(item.dissipador);
      if (item.hardware === "Processador") {
        card.classList.add("processador");
      } else if (dissipador) {
        card.classList.add("memoria-com-dissipador");
      } else {
        card.classList.add("memoria-sem-dissipador");
      }
      const icone = item.hardware === "Processador" ? "cpu.png" : "ram.png";
      card.innerHTML = `
        <div class="card-header">
          <img src="icon/${icone}" class="icone-hardware" id="iconeSeparado" alt="Icone ${item.hardware}">
          <strong id="skuTitulo" >${item.sku}</strong>
          <span class="qtd">${item.qtd} un</span>
        </div>
        <div class="card-body">
          <em>${item.modelo || 'Modelo não cadastrado'}</em>
        </div>
        <button class="btn-preparar" onclick="prepararItem(${item.id}, '${item.hardware}', ${item.qtd}, '${item.sku}', ${item.dissipador})">Adicionar</button>
      `;
      area.appendChild(card);
    });
  }

  const total = Math.ceil((lista.length || 0) / itensPorPaginaPreparacao) || 1;
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

  const total = Math.ceil((dadosPreparados.length || 0) / itensPorPaginaPreparados) || 1;
  document.getElementById("paginaPreparados").textContent = `${paginaPreparados} / ${total}`;
  document.getElementById("btnPrepAnt").disabled = paginaPreparados === 1;
  document.getElementById("btnPrepProx").disabled = paginaPreparados === total;
}
//botoes de paginação tela preparação
function pgnAnteriorSep() {
  const total = Math.ceil(dadosSeparados.length / itensPorPaginaPreparacao) || 1;
  if (paginaSeparados > 1) {
    paginaSeparados--;
    } else {
    paginaSeparados = total;
  }
  renderizarSeparadosPaginado();
}
function pgnProximoSep() {
  const total = Math.ceil(dadosSeparados.length / itensPorPaginaPreparacao) || 1;
  if (paginaSeparados < total) {
    paginaSeparados++;
  } else {
    paginaSeparados = 1;
  }
  renderizarSeparadosPaginado();
}
function pgnAnteriorPre() {
  const total = Math.ceil(dadosPreparados.length / itensPorPaginaPreparados) || 1;
  if (paginaPreparados > 1) {
    paginaPreparados--;
  } else {
    paginaPreparados = total;
  }
  renderizarSkusPreparadosExpandido();
}
function pgnProximoPre() {
  const total = Math.ceil(dadosPreparados.length / itensPorPaginaPreparados) || 1;
  if (paginaPreparados < total) {
    paginaPreparados++;
  } else {
    paginaPreparados = 1;
  }
  renderizarSkusPreparadosExpandido();
}
function pgnAnteriorEmb() {
  const filtradas = dadosEmbalagens.filter(e => {
    if (filtroStatusEmbalagem === 'todas') return true;
    return e.status === filtroStatusEmbalagem;
  });
  const total = Math.ceil(filtradas.length / itensPorPaginaPreparacao) || 1;
  if (paginaEmbalagens > 1) {
    paginaEmbalagens--;
  } else {
    paginaEmbalagens = total;
  }
  renderizarEmbalagensPaginado();
}
function pgnProximoEmb() {
  const filtradas = dadosEmbalagens.filter(e => {
    if (filtroStatusEmbalagem === 'todas') return true;
    return e.status === filtroStatusEmbalagem;
  });
  const total = Math.ceil(filtradas.length / itensPorPaginaPreparacao) || 1;
  if (paginaEmbalagens < total) {
    paginaEmbalagens++;
  } else {
    paginaEmbalagens = 1;
  }
  renderizarEmbalagensPaginado();
}
//------------------------------------//
function filtrarEmbalagens() {
  const select = document.getElementById('filtroEmbalagens');
  filtroStatusEmbalagem = select.value;
  paginaEmbalagens = 1;
  renderizarEmbalagensPaginado();
}
function filtrarSeparados() {
  const input = document.getElementById('buscaSeparados');
  filtroSeparados = input.value;
  paginaSeparados = 1;
  renderizarSeparadosPaginado();
}
function ordenarSeparados(ordem) {
  ordemSeparados = ordem;
  paginaSeparados = 1;
  renderizarSeparadosPaginado();
}
async function prepararItem(itemId, hardware, qtd, sku, dissipador) {
  try {
        if (hardware === "Memória RAM" || hardware === "Processador") {
      const res = await fetch(`${API_URL}/embalagens/${pedidoIdAtual}`);
      const emb = await res.json();
      if (hardware === "Memória RAM") {
        const abertos = emb.filter(e => e.tipo === 'blister' && e.status === 'aberto');
        if (abertos.length === 0) {
          mostrarAviso("⚠️ Abra um blister antes de preparar.", "#f39c12");
          return;
        }
      } else {
        const abertos = emb.filter(e => e.tipo === 'caixa' && e.status === 'aberto');
        if (abertos.length === 0) {
          mostrarAviso("⚠️ Abra uma caixa antes de preparar.", "#f39c12");
          return;
        }
      }
    }
    const resposta = await fetch(`${API_URL}/itens-preparados/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "preparado", qtd})
    });

    if (!resposta.ok) throw new Error("Erro ao preparar item");

 // SKU vindo por parâmetro garante que não será "desconhecido"
    const skuValue = sku || (dadosSeparados.find(s => s.id === itemId)?.sku);
    const skuFinal = skuValue || "SKU desconhecido";

    // 🔥 Distribuir automaticamente
    if (hardware === "Memória RAM") {
     await distribuirSkuParaBlisters(itemId, skuFinal, qtd, hardware, dissipador);
    } else if (hardware === "Processador") {
      await distribuirSkuParaCaixas(itemId, skuFinal, qtd, hardware);
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

  fetch(`${API_URL}/embalagens`, {
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
    const capacidadeInicial = tipoSelecionado === 'caixa' ? 100 : 0;

    for (let i = 0; i < quantidade; i++) {
      await fetch(`${API_URL}/embalagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido_id: pedidoIdAtual,
          tipo: tipoSelecionado,
          status: "aberto",
          capacidade: capacidadeInicial
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

let embalagemSelecionada = null;
let espacoDisponivel = 0;
let tipoEmbalagemSelecionada = null;

function abrirModalAddSku(id, tipo, disponivel, capacidade) {
  embalagemSelecionada = id;
  tipoEmbalagemSelecionada = tipo;
  espacoDisponivel = disponivel;
  capacidadeEmbalagemSelecionada = capacidade;
  const select = document.getElementById('selectAddSku');
  select.innerHTML = '';
  dadosSeparados.forEach(item => {
    if (item.qtd <= disponivel) {
      if (
        (tipo === 'blister' && item.hardware === 'Memória RAM') ||
        (tipo === 'caixa' && item.hardware === 'Processador')
      ) {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = `${item.sku} - ${item.qtd} un`;
        select.appendChild(opt);
      }
    }
  });
  document.getElementById('modalAddSku').classList.remove('hidden');
}
function fecharModalAddSku() {
  document.getElementById('modalAddSku').classList.add('hidden');
  tipoEmbalagemSelecionada = null;
}
async function confirmarAddSku() {
  const select = document.getElementById('selectAddSku');
  const itemId = select.value;
  const item = dadosSeparados.find(i => i.id == itemId);
  if (!item) return;
  await fetch(`${API_URL}/embalagens/${embalagemSelecionada}/adicionar-sku`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      item_id: item.id,
      sku: item.sku,
      qtd: item.qtd,
      dissipador: item.dissipador
    })
  });
  fecharModalAddSku();
  await carregarSkusSeparados();
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
    await fetch(`${API_URL}/itens/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "preparado" })
    });

    // 2. Atualiza o status do blister (para 'fechado' se estiver cheio)
    const novoStatus = qtd >= 25 ? "fechado" : "aberto";
    await fetch(`${API_URL}/embalagens/${blisterId}`, {
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
async function iniciarPreparacao(id, numeroPedido) {
  pedidoIdAtual = id;
  pedidoAtual = numeroPedido;
  document.getElementById("tituloPedidoPreparacao").textContent = numeroPedido;
  document.getElementById("idPedidoPreparacao").textContent = id;
  mostrarTela("telaPreparacao");
  await carregarSkusSeparados();
  await carregarEmbalagens(pedidoIdAtual);
  renderizarSkusPreparadosExpandido();
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
  fetch(`${API_URL}/pedidos/${idPedido}/voltar`, {
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
async function atualizarHistoricoDoBanco() {
  try {
    const data = await (await fetch(`${API_URL}/pedidosprep`)).json();
    const mapa = new Map();
    data.forEach(p => {
      const chave = String(p.pedido).trim().toLowerCase();
      if (!mapa.has(chave) || p.id > mapa.get(chave).id) {
        mapa.set(chave, p);
      }
    });
    historicoPedidos = Array.from(mapa.values());
    historicoPedidos.sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
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
  fetch(`${API_URL}/pedidos/${id}`)
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
      consultarSkusSeparados();
      atualizarInterface();
      carregarSKUsDoBanco();
    })
    .catch(err => {
      console.error("Erro ao continuar pedido:", err);
      mostrarAviso("❌ Erro ao recuperar pedido.", "#e74c3c");
    });
}
function confirmarNovoPedido() {
  const pedido = document.getElementById("pedidoInput").value.trim();
  if (!pedido) {
    mostrarAviso("❌ Digite o número do pedido", "#e74c3c");
    return;
  }

  document.getElementById("modalNovoPedido").classList.add("hidden");

  const inicio = new Date().toISOString().slice(0, 19).replace("T", " ");

  fetch(`${API_URL}/iniciar`, {
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
      atualizarInterface();
      carregarSKUsDoBanco();

      mostrarAviso(`✅ Pedido ${pedido} criado com sucesso.`, "#2ecc71");
    })
    .catch((err) => {
      console.error("Erro ao criar pedido:", err);
      mostrarAviso("❌ Erro ao criar pedido.", "#e74c3c");
    });
}
function cancelarPedido(id) {
  if (!confirm("Tem certeza que deseja cancelar este pedido?")) return;

  fetch(`${API_URL}/pedidos/${id}`, {
    method: "DELETE",
  })
    .then((res) => {
      if (!res.ok) throw new Error("Erro ao cancelar");
      carregarPedidosEstoque(); // atualiza lista
      mostrarAviso("Pedido cancelado com sucesso.", "#e67e22");
      atualizarInterface();
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
  fetch(`${API_URL}/iniciar`, {
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
    modelo,
    dissipador
  };

  fetch(`${API_URL}/itens`, {
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

  fetch(`${API_URL}/itens/${pedidoIdAtual}`)
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
              <h4>Memórias: ${totalMemorias}</h4>
            </div>
            <div class="resumo-processador">
              <h4>Processadores: ${totalProcessadores}</h4>
            </div>
        </div>
        <div class="resumo-itens-wrapper">
            <div class="resumo-itens">
              <h4>Total de Itens: ${totalItens}</h4>
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
  fetch(`${API_URL}/itens/${pedidoIdAtual}`)
    .then(res => res.json())
    .then(itens => {
      const area = document.getElementById("listaSkusSeparados");
      area.innerHTML = "";

      let bloqueado = false;

      if (itens.length === 0) {
        area.innerHTML = "<p>Nenhum SKU separado ainda.</p>";
        return;
      }

      itens.forEach((item) => {
        const div = document.createElement("div");
div.className = "card-sku"; // novo nome da classe para evitar conflito
if (item.hardware === "Não preenchido") {
          div.classList.add("pendente");
          bloqueado = true;
        }

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
      
      document.getElementById("btnFinalizar").disabled = bloqueado;
    })
    .catch(err => {
      console.error("Erro ao buscar SKUs:", err);
      mostrarAviso("❌ Erro ao buscar SKUs.", "#e74c3c");
    });
}
function removerSku(id) {
  fetch(`${API_URL}/itens/${id}`, {
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
async function enviarPedido() {
  if (document.getElementById("btnFinalizar").disabled) {
    mostrarAviso("❌ Cadastre o SKU antes de enviar o pedido.", "#f39c12");
    return;
  }
  try {
    const itens = await fetch(`${API_URL}/itens/${pedidoIdAtual}`).then(r => r.json());

   let qtd_memoria = 0;
   let qtd_processador = 0;

    itens.forEach(item => {
      if (item.hardware === "Memória RAM") {
        qtd_memoria += item.qtd;
      } else if (item.hardware === "Processador") {
        qtd_processador += item.qtd;
      }
    });

   const res = await fetch(`${API_URL}/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pedidoId: pedidoIdAtual,
        qtd_memoria,
        qtd_processador
      })
    });

    const data = await res.json();
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
async function finalizarPreparacao() {
  try {
    const res = await fetch(`${API_URL}/pedidos/${pedidoIdAtual}/finalizar`, {
      method: 'PUT'
    });
    const data = await res.json();
    if (data.success) {
      mostrarAviso('✅ Preparação finalizada!', '#2ecc71');
      mostrarTela('telaExpedicao');
      carregarPedidosExpedicao();
    } else {
      mostrarAviso('❌ Falha ao finalizar.', '#e74c3c');
    }
  } catch (err) {
    console.error('Erro ao finalizar preparação:', err);
    mostrarAviso('❌ Erro ao finalizar preparação.', '#e74c3c');
  }
}
function mostrarHistorico() {
  mostrarTela('telaHistorico');

  historicoPaginaAtual = 1;
  carregarHistoricoPaginado();
}
async function carregarHistoricoPaginado() {
  const container = document.getElementById("historicoContainer");
  container.innerHTML = "";

  const filtro = document
    .getElementById("pesquisaHistorico")
    .value.toLowerCase();
  const listaPedidos = historicoPedidos.filter((p) =>
    p.pedido.toLowerCase().includes(filtro)
  );

  historicoTotalPaginas = Math.ceil(
    listaPedidos.length / historicoItensPorPagina
  );
  if (historicoTotalPaginas === 0) historicoTotalPaginas = 1;
  if (historicoPaginaAtual > historicoTotalPaginas)
    historicoPaginaAtual = historicoTotalPaginas;

  const inicio = (historicoPaginaAtual - 1) * historicoItensPorPagina;
  const fim = inicio + historicoItensPorPagina;
  const pedidosPagina = listaPedidos.slice(inicio, fim);
  
  for (const pedido of pedidosPagina) {
    const pedidoDiv = document.createElement("div");
    pedidoDiv.className = "pedido-container";

    let itens = [];
    let embalagens = [];
    let skusDados = [];
    try {
      [itens, embalagens, skusDados] = await Promise.all([
        fetch(`${API_URL}/itens/${pedido.id}`).then(r => r.json()),
        fetch(`${API_URL}/embalagens/${pedido.id}`).then(r => r.json()),
        fetch(`${API_URL}/sku-emblist/${pedido.id}`).then(r => r.json()),
      ]);
    } catch (err) {
      console.error("Erro ao buscar dados do pedido:", err);
    }

    const qtdMemorias = itens
      .filter(i => i.hardware === "Memória RAM")
      .reduce((s, i) => s + i.qtd, 0);
    const qtdProcessadores = itens
      .filter(i => i.hardware === "Processador")
      .reduce((s, i) => s + i.qtd, 0);
    const totalItens = qtdMemorias + qtdProcessadores;

    const qtdBlisters = embalagens.filter(e => e.tipo === "blister").length;
    const qtdCaixas = embalagens.filter(e => e.tipo === "caixa").length;
    const totalEmbalagens = embalagens.length;

    const skusMap = {};
    skusDados.forEach(({ sku, qtd, embalagem_id, tipo }) => {
       if (!skusMap[sku]) {
        const infoItem = itens.find(i => i.sku === sku);
        skusMap[sku] = {
          qtd: 0,
          bls: [],
          hardware: infoItem ? infoItem.hardware : "Não preenchido"
        };
      }
      skusMap[sku].qtd += qtd;
      skusMap[sku].bls.push({ id: embalagem_id, qtd, tipo });
    });

         const skusHTML = Object.entries(skusMap)
      .map(([sku, info]) => {
        const icone =
          info.hardware === "Processador" ? "cpu.png" : "ram.png";
        const listaOculta =
          info.bls
            .map(
              (b) =>
                `<li>${b.tipo === "caixa" ? "C" : "B"}${String(b.id).padStart(3, "0")} - ${b.qtd} un</li>`
            )
            .join("") || "<li>Não alocado</li>";
        return `
        <div class="sku-historico">
          <div class="sku-htopo">
            <img src="icon/${icone}" class="icone-hardware" alt="Icone ${info.hardware}">
            <span class="hardware-nome">${info.hardware}</span>
          </div>
        <div class="sku-hinfo">
              <div><strong>${sku} - Qtd: ${info.qtd}</strong></div>
          </div>
          <button class="btn-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">Ver embalagens</button>
          <ul class="lista-embalagens hidden">${listaOculta}</ul>
        </div>`;
      })
      .join("");

    pedidoDiv.innerHTML = `
      <div class="pedido-titulo">
        <h4>Pedido ${pedido.pedido}</h4>
      </div>
      <div class="info-cards">
        <div class="card-info">
          <div><p>ID: ${pedido.id}</p></div>
          <div><p>Data de envio: ${pedido.inicio ? new Date(pedido.inicio).toLocaleDateString() : ""}</p></div>
          <div><p>Tipo: ${pedido.tipo}</p></div>
          <div class="pedido-botoes">
            <button onclick="gerarPDF(${pedido.id})" class="btn-imprimir">🖨️ Imprimir</button>
            <button onclick="toggleSKUs(this)" class="btn-skus">Ver SKUs</button>
          </div>
        </div>
        <div class="card-qtd">
          <div class="mini-card">
          <h4>Qtd. Hardware</h4>
            <div>
              <p>Memórias: ${qtdMemorias}</p>
            </div>
            <div>
              <p>Blisters: ${qtdBlisters}</p>
            </div>
          </div>
          <div class="mini-card">
          <h4>Qtd. Embalagens</h4>
            <div>
              <p>Processadores: ${qtdProcessadores}</p>
            </div>
            <div>
            <p>Caixas: ${qtdCaixas}</p>
            </div>
          </div>
          <div class="mini-card">
          <h4>Qtd. Gerais</h4>
            <div>
            <p>Itens: ${totalItens}</p>
            </div>
            <div><p>Embalagens: ${totalEmbalagens}</p></div>
          </div>
        </div>
      </div>
      <div class="skus-container hidden">
        ${skusHTML}
      </div>
    `;
    container.appendChild(pedidoDiv);
  }
  atualizarControlesPaginacaoHistorico();
}
function atualizarControlesPaginacaoHistorico() {
  const paginacao = document.getElementById("paginacaoHistorico");
  paginacao.innerHTML = `
    <button onclick="paginaAnteriorHistorico()" ${historicoPaginaAtual === 1 ? "disabled" : ""
    }>◀</button>
    <span>${historicoPaginaAtual} / ${historicoTotalPaginas}</span>
    <button onclick="proximaPaginaHistorico()" ${historicoPaginaAtual === historicoTotalPaginas ? "disabled" : ""
    }>▶</button>
  `;
}
function paginaAnteriorHistorico() {
  if (historicoPaginaAtual > 1) {
    historicoPaginaAtual--;
    } else {
    historicoPaginaAtual = historicoTotalPaginas;
  }
  carregarHistoricoPaginado();
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
async function gerarPDF(pedidoId) {
  const doc = new jsPDF();

  const pedidoObj = historicoPedidos.find((p) => p.id === pedidoId);
  if (!pedidoObj) return;

  const [itens, embalagens] = await Promise.all([
    fetch(`${API_URL}/itens/${pedidoId}`).then((r) => r.json()),
    fetch(`${API_URL}/embalagens/${pedidoId}`).then((r) => r.json()),
  ]);

  const mapaSkus = {};
  itens.forEach((i) => {
    if (mapaSkus[i.sku]) {
      mapaSkus[i.sku].qtd += i.qtd;
    } else {
      mapaSkus[i.sku] = { ...i };
    }
  });
  const itensConsolidados = Object.values(mapaSkus);

  const totalItens = itensConsolidados.reduce((s, i) => s + (i.qtd || 0), 0);
  const totalEmbalagens = embalagens.length;
  const totalMemorias = itensConsolidados
    .filter((i) => i.hardware === "Memória RAM")
    .reduce((s, i) => s + (i.qtd || 0), 0);
  const totalProcessadores = itensConsolidados
    .filter((i) => i.hardware === "Processador")
    .reduce((s, i) => s + (i.qtd || 0), 0);

  // Cabeçalho
  doc.setFontSize(16);
  doc.setFillColor(130);
  doc.roundedRect(0, 0, 210, 25, 6, 6, "F");
  doc.text(`Pedido ${pedidoObj.pedido}`, 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleString()}`, 105, 20, {
    align: "center",
  });

  let y = 30;
  const cardW = 90;
  const cardH = 15;
  const spacing = 10;

  // Quantidades Totais
  doc.setFillColor(230);
  doc.roundedRect(15, y, cardW, cardH, 3, 3, "F");
  doc.roundedRect(110, y, cardW, cardH, 3, 3, "F");
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Memórias: ${totalMemorias}`, 115, y + 5);
  doc.text(`Processadores: ${totalProcessadores}`, 115, y + 12);
  doc.text(`Total Itens: ${totalItens}`, 20, y + 5);
  doc.text(`Total Embalagens: ${totalEmbalagens}`, 20, y + 12);

  y += cardH + spacing * 1.5;
  doc.setFontSize(14);
  doc.text("SKUs Separados", 105, y, { align: "center" });
  y += 8;

  const itemCardW = 180;
  const itemCardH = 20;

  itensConsolidados.forEach((item) => {
    if (y + itemCardH > 280) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(230);
    doc.roundedRect(15, y, itemCardW, itemCardH, 3, 3, "F");
    doc.setFontSize(10);
    doc.setTextColor(0);

    const modeloLines = doc.splitTextToSize(item.modelo, 90);

    doc.text(`SKU: ${item.sku}`, 18, y + 7);
    doc.text(`Hardware: ${item.hardware}`, 90, y + 7);
    doc.text(`Modelo:`, 18, y + 15);
    doc.text(modeloLines, 38, y + 15);
    doc.text(`Qtd.: ${item.qtd}`, 160, y + 7);

    y += itemCardH + 5;
  });

  doc.save(`pedido_${pedidoObj.pedido}.pdf`);
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
function carregarSKUs() {
  fetch(`${API_URL}/skus`)
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

  pagina.forEach((sku, i) => {
    const linha = document.createElement("tr");

    const pendente = skusPendentes.some((p) => p.SKU === sku.SKU);

    const idx = inicio + i;

    linha.innerHTML = `
      <td>${sku.SKU}${pendente ? " 🕒" : ""}</td>
      <td>${sku.hardware}</td>
      <td>${sku.modelo}</td>
      <td>${pendente ? '<span style="color: #f39c12;">Pendente</span>' : `<button onclick="abrirModalExcluirSku(${idx})">🗑️</button>`}</td>
    `;

    if (pendente) {
      linha.style.backgroundColor = "#fff3cd"; // Amarelo claro
    }

    tbody.appendChild(linha);
  });

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

  fetch(`${API_URL}/salvar-skus`, {
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
function abrirModalExcluirSku(index) {
  indiceExcluir = index;
  const sku = listaFiltradaSkus[index];

  document.getElementById('modalMensagem').textContent = `Excluir o SKU ${sku.SKU}?`;
  document.getElementById('modalExcluir').classList.remove('hidden');
}
function fecharModalExcluir() {
  document.getElementById('modalExcluir').classList.add('hidden');
}
async function confirmarExcluirSku() {
  if (indiceExcluir === null) return;
  const sku = listaFiltradaSkus[indiceExcluir];
  try {
    const response = await fetch(
      `${API_URL}/api/excluir-sku/${encodeURIComponent(sku.SKU)}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro desconhecido ao excluir SKU");
    }

    await carregarSKUs();
    mostrarAviso("✅ SKU excluído com sucesso!", "#2ecc71");
    atualizarLista();
  } catch (err) {
    console.error("Erro ao excluir SKU:", err);
    mostrarAviso("❌ Erro ao excluir SKU: " + err.message, "#e74c3c");
  }
  indiceExcluir = null;
  fecharModalExcluir();
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
