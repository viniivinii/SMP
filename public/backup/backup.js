//variaveis globais
let pedidos = JSON.parse(localStorage.getItem("pedidosRAM") || "{}");
let pedidoAtual = localStorage.getItem("pedidoAtual") || null;
let tempoInicio = null;
let pedidoIdAtual = localStorage.getItem("pedidoIdAtual") || null;
let historicoPedidos = [];

const API_URL = "http://10.10.2.94:5501"; // URL do servidor Node.js

let skusCustomizados = JSON.parse(localStorage.getItem("skusCustomizados") || "[]");
let skuData = [];
let listaCompletaSKUs = [];
let listaFiltradaSKUs = [];
const { jsPDF } = window.jspdf;

let historicoPaginaAtual = 1;
let historicoItensPorPagina = 5;
let historicoTotalPaginas = 1;


window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnHistorico").addEventListener("click", () => {
    atualizarHistoricoDoBanco();
  });
  carregarSKUs();
});

window.addEventListener("DOMContentLoaded", carregarSKUsDoBanco);
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
    listaDoBanco.forEach(p => {
      pedidosFormatados[p.pedido] = {
        id: p.id,
        inicio: p.inicio,
        fim: p.fim,
        skus: p.skus || []
      };
    });

    // Atualiza as variáveis globais e o localStorage
    pedidos = pedidosFormatados;
    localStorage.setItem("pedidosRAM", JSON.stringify(pedidosFormatados));

    mostrarHistorico();
  } catch (erro) {
    console.error("Erro ao atualizar histórico:", erro);
    mostrarAviso("❌ Não foi possível atualizar o histórico do banco.", "#e74c3c");
  }
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
    body: JSON.stringify({ pedido, inicio })
  })
    .then(res => {
      if (!res.ok) { throw new Error("Erro ao iniciar pedido."); }
      return res.json();
    })
    .then(data => {
      console.log("Pedido iniciado:", data);
      pedidoIdAtual = data.id;
      const id = data.id || pedidoIdAtual; // Garante que o ID seja usado corretamente
      // const id = data.id;
      pedidoAtual = pedido;

      console.log("Pedido iniciado:", pedido, "ID:", pedidoIdAtual);

      pedidos[pedido] = {
        id,
        skus: [],
        inicio
      };

      localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));
      localStorage.setItem("pedidoAtual", pedidoAtual);
      localStorage.setItem("pedidoIdAtual", pedidoIdAtual);

      document.getElementById("telaInicio").classList.add("hidden");
      document.getElementById("telaPedido").classList.remove("hidden");
      document.getElementById("resumoPedido").innerText = `Pedido ${pedido}`;

      mostrarAviso(`✅ Pedido ${pedido} iniciado com sucesso!`, "#2ecc71");
    })
    .catch(err => {
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
  const skus = pedidos[pedidoAtual].skus;
  const infoSku = skuData.find(item => item.SKU.toUpperCase() === sku.toUpperCase());
  const hardware = infoSku ? infoSku.hardware : "Não preenchido";
  const modelo = infoSku ? infoSku.modelo : "Não preenchido";
  if (hardware === "Processador") {
    const caixasInput = prompt("Quantas **caixas** deseja adicionar para este SKU?");
    const qtdCaixas = parseInt(caixasInput);
    if (isNaN(qtdCaixas) || qtdCaixas <= 0) {
      mostrarAviso("Quantidade de caixas inválida.", "#e74c3c");
      return;
    }
    const existente = skus.find(item => item.sku === sku);
    if (existente) {
      existente.qtdProcessadores += qtdItem;
      existente.qtdCaixas += qtdCaixas;
      existente.codigo = `${sku}-P${existente.qtdProcessadores}-CX${existente.qtdCaixas}`;
    } else {
      const codigo = `${sku}-P${qtdItem}-CX${qtdCaixas}`;
      skus.push({ sku, qtdProcessadores: qtdItem, qtdCaixas, codigo, hardware, modelo });
    }
  } else {
    const existente = skus.find(item => item.sku === sku && item.dissipador === dissipador);
    if (existente) {
      existente.qtdMemorias += qtdItem;
      existente.qtdBlisters = Math.ceil(existente.qtdMemorias / porBlister);
      existente.codigo = `${sku}-${existente.qtdMemorias}-${existente.qtdBlisters}`;
    } else {
      const qtdBlisters = Math.ceil(qtdItem / porBlister);
      const codigo = `${sku}-${qtdItem}-${qtdBlisters}`;
      skus.push({ sku, qtdMemorias: qtdItem, dissipador, qtdBlisters, codigo, hardware, modelo });
    }
  }
  document.getElementById("sku").value = "";
  document.getElementById("qtdItem").value = "";
  document.getElementById("dissipador").checked = false;
  atualizarInterface();
}
function atualizarInterface() {
  const lista = document.getElementById("listaSkus");
  lista.innerHTML = "";
  let totalMemorias = 0;
  let totalBlisters = 0;
  let totalProcessadores = 0;
  let totalCaixas = 0;

  pedidos[pedidoAtual].skus.forEach((item, index) => {
    if (item.hardware === "Processador") {
      totalProcessadores += item.qtdProcessadores || 0;
      totalCaixas += item.qtdCaixas || 0;
    } else {
      totalMemorias += item.qtdMemorias || 0;
      totalBlisters += item.qtdBlisters || 0;
    }
    const div = document.createElement("div");
    div.className = "sku-card";
    div.style.display = "flex";
    div.style.justifyContent = "space-between";
    div.style.alignItems = "center";
    div.innerHTML = `
          <div style="flex: 1;">
            <strong>SKU:</strong> ${item.sku}<br>
            <strong>${item.hardware}</strong> - ${item.modelo}<br>
            ${item.hardware === "Processador"
        ? `<strong>Quantidade:</strong> ${item.qtdProcessadores}<br>
                   <strong>Caixa(s):</strong> ${item.qtdCaixas}<br>`
        : `<strong>Quantidade:</strong> ${item.qtdMemorias}<br>
                   <strong>Blister(s):</strong> ${item.qtdBlisters}<br>`
      }
            <button class="btn-excluir" style="margin-top: 10px;" onclick="removerSKU(${index})">🗑️ Remover SKU</button>
          </div>
          <div style="flex-shrink: 0;">
            <svg class="barcode" id="barcode-${index}"></svg>
          </div>
        `;
    lista.appendChild(div);
    JsBarcode(`#barcode-${index}`, item.codigo, {
      format: "CODE128",
      displayValue: true,
      fontSize: 16,
      width: 2,
      height: 40
    });
  });
  const resumo = document.getElementById("resumoPedido");
  const totalItens = totalMemorias + totalProcessadores;

  resumo.innerHTML = `
        <h3 class="resumo-titulo">Pedido ${pedidoAtual} ID: ${pedidoIdAtual}</h3>
        <div class="resumo-container">
            <div class="resumo-memoria">
              <strong>Memórias:</strong> ${totalMemorias}<br>
              <strong>Blisters:</strong> ${totalBlisters}
            </div>
            <div class="resumo-processador">
              <strong>Processadores:</strong> ${totalProcessadores}<br>
              <strong>Caixas:</strong> ${totalCaixas}
            </div>
        </div>
        <div class="resumo-itens-wrapper">
            <div class="resumo-total-itens">
              <strong>Total de Itens:</strong> ${totalItens}
            </div>
        </div>
    `;
}
function removerSKU(index) {
  pedidos[pedidoAtual].skus.splice(index, 1);
  atualizarInterface();
}
// Finalizar pedido
async function finalizarPedido() {
  const fim = new Date().toISOString().slice(0, 19).replace("T", " ");

  console.log("pedido atual:", pedidoAtual);
  console.log("Id do pedido atual:", pedidoIdAtual);

  const id = localStorage.getItem("pedidoIdAtual");

  if (!id) {
    mostrarAviso("⚠️ Nenhum pedido ativo para finalizar.", "#e74c3c");
    return;
  }

  const pedido = pedidos[pedidoAtual];
  if (!pedido) {
    mostrarAviso("⚠️ Pedido não encontrado.", "#e74c3c");
    return;
  }

  // Valida se o id é número
  if (isNaN(id)) {
    mostrarAviso("❌ ID do pedido inválido, deve ser número.", "#e74c3c");
    return;
  }

  const skus = pedido.skus.map(item => ({
    sku: item.sku,
    qtdItem: item.hardware === "Processador" ? item.qtdProcessadores : item.qtdMemorias,
    qtdEmbalagem: item.hardware === "Processador" ? item.qtdCaixas : item.qtdBlisters,
    dissipador: item.dissipador || false,
    codigo: item.codigo,
    hardware: item.hardware,
    modelo: item.modelo
  }));

  fetch("https://10.10.2.94:5501/finalizar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id, fim, skus })
  })
    .then(res => res.text())
    .then(msg => {
      mostrarAviso(msg, "#2ecc71");
      localStorage.removeItem("pedidoAtual");
      delete pedidos[pedidoAtual];
      delete pedidos[id];
      localStorage.setItem("pedidosRAM", JSON.stringify(pedidos));
      location.reload();
    })
    .catch(err => {
      console.error("Erro ao finalizar pedido:", err);
      mostrarAviso("❌ Erro ao finalizar pedido.");
    });
}
function mostrarHistorico() {
  document.getElementById("telaInicio").classList.add("hidden");
  document.getElementById("telaPedido").classList.add("hidden");
  document.getElementById("telaHistorico").classList.remove("hidden");

  historicoPaginaAtual = 1;
  carregarHistoricoPaginado();
}
function carregarHistoricoPaginado() {
  const container = document.getElementById("historicoContainer");
  container.innerHTML = "";

  const filtro = document.getElementById("pesquisaHistorico").value.toLowerCase();
  const listaPedidos = Object.entries(pedidos).filter(([pedido, _dados]) =>
    pedido.toLowerCase().includes(filtro)
  );

  // ⬅️ Aqui está o cálculo correto de total de páginas
  historicoTotalPaginas = Math.ceil(listaPedidos.length / historicoItensPorPagina);
  if (historicoTotalPaginas === 0) historicoTotalPaginas = 1;
  if (historicoPaginaAtual > historicoTotalPaginas) historicoPaginaAtual = historicoTotalPaginas;

  const inicio = (historicoPaginaAtual - 1) * historicoItensPorPagina;
  const fim = inicio + historicoItensPorPagina;
  const pedidosPagina = listaPedidos.slice(inicio, fim);

  pedidosPagina.forEach(([pedido, pedidoData]) => {
    let totalMemorias = 0;
    let totalBlisters = 0;
    let totalProcessadores = 0;
    let totalCaixas = 0;

    pedidoData.skus.forEach(item => {
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
    blocosResumoHTML += '</div>';

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
        ${pedidoData.skus.map((item) => `
          <div class="sku-card">
            <strong>SKU:</strong> ${item.sku}<br>
            <strong>${item.hardware}</strong> - ${item.modelo}<br>
            ${item.hardware === "Processador"
        ? `<strong>Quantidade:</strong> ${item.qtdProcessadores || 0}<br>
                 <strong>Caixa(s):</strong> ${item.qtdCaixas || 0}`
        : `<strong>Quantidade:</strong> ${item.qtdMemorias || 0}<br>
                 <strong>Blister(s):</strong> ${item.qtdBlisters || 0}`
      }
          </div>
        `).join("")}
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
    <button onclick="paginaAnteriorHistorico()" ${historicoPaginaAtual === 1 ? "disabled" : ""}>⬅️ Anterior</button>
    <span>${historicoPaginaAtual} / ${historicoTotalPaginas}</span>
    <button onclick="proximaPaginaHistorico()" ${historicoPaginaAtual === historicoTotalPaginas ? "disabled" : ""}>Próxima ➡️</button>
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
  const skusContainer = button.closest(".pedido-container").querySelector(".skus-container");
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
  doc.rect(0, 0, 210, 20, 'F');
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
    doc.roundedRect(15, y, cardWidth, cardHeight, 3, 3, 'F');

    doc.setFontSize(9);
    doc.setTextColor(0);

    const modeloLines = doc.splitTextToSize(item.modelo, 90);

    doc.text(`SKU: ${item.sku}`, 18, y + 7);
    doc.text(`Hardware: ${item.hardware}`, 18, y + 14);
    doc.text(`Modelo:`, 18, y + 21);
    doc.text(modeloLines, 38, y + 21);

    const isProc = item.hardware === "Processador";
    const qtdTotal = isProc ? (item.qtd || item.qtdProcessadores || 0) : (item.qtdMemorias || item.qtd || 0);
    const qtdBlisterOuCaixa = isProc ? (item.qtdCaixas || 0) : (item.qtdBlisters || 0);
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
  doc.roundedRect(15, y, cardWidth, 20, 3, 3, 'F');
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
  doc.rect(startX, rowY, 190, 10, 'F');
  doc.setTextColor(0);
  doc.text("SKU", startX + 2, rowY + 7);
  doc.text("Hardware", startX + colWidths[0] + 2, rowY + 7);
  doc.text("Modelo", startX + colWidths[0] + colWidths[1] + 2, rowY + 7);
  doc.text("Blisters/Caixas", startX + colWidths[0] + colWidths[1] + colWidths[2] + 2, rowY + 7);
  doc.text("Qtd.", startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, rowY + 7);

  rowY += 10;

  pedidoData.skus.forEach(item => {
    if (rowY + 10 > 280) return; // evita ultrapassar a página

    const isProc = item.hardware === "Processador";
    const qtd = isProc ? (item.qtd || item.qtdProcessadores || 0) : (item.qtdMemorias || item.qtd || 0);
    const caixasOuBlisters = isProc ? (item.qtdCaixas || 0) : (item.qtdBlisters || 0);
    const modeloLines = doc.splitTextToSize(item.modelo, colWidths[2] - 4);

    // Celulas da linha
    doc.setDrawColor(150);
    doc.setFillColor(255);

    // Coluna SKU
    doc.rect(startX, rowY, colWidths[0], 10, 'S');
    doc.text(item.sku, startX + 2, rowY + 7);

    // Coluna Hardware
    doc.rect(startX + colWidths[0], rowY, colWidths[1], 10, 'S');
    doc.text(item.hardware, startX + colWidths[0] + 2, rowY + 7);

    // Coluna Modelo
    doc.rect(startX + colWidths[0] + colWidths[1], rowY, colWidths[2], 10, 'S');
    doc.text(modeloLines, startX + colWidths[0] + colWidths[1] + 2, rowY + 4);

    // Coluna Blisters/Caixas
    doc.rect(startX + colWidths[0] + colWidths[1] + colWidths[2], rowY, colWidths[3], 10, 'S');
    doc.text(`${isProc ? 'Caixas' : 'Blisters'}: ${caixasOuBlisters}`, startX + colWidths[0] + colWidths[1] + colWidths[2] + 2, rowY + 7);

    // Coluna Qtd
    doc.rect(startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowY, colWidths[4], 10, 'S');
    doc.text(`${qtd}`, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 2, rowY + 7);

    rowY += 10;
  });

  doc.save(`pedido_${pedido}.pdf`);
}
function voltar() {
  document.getElementById("telaHistorico").classList.add("hidden");
  document.getElementById("telaInicio").classList.remove("hidden");
}
document.getElementById("sku").addEventListener("input", function () {
  const valor = this.value.trim();
  const codigoCompleto = "PC" + valor;
  const encontrado = listaCompletaSKUs.find(item => item.SKU === codigoCompleto);

  if (encontrado) {
    const hardware = encontrado.hardware;
    const modelo = encontrado.modelo;
  } else {
    const hardware = "Não encontrado";
    const modelo = "Não encontrado";
  }
});
function atualizarResumoPedido() {
  const resumoContainer = document.getElementById('resumoPedido');
  if (!resumoContainer || pedidoAtual.skus.length === 0) {
    resumoContainer.innerHTML = '';
    return;
  }

  let totalMemorias = 0, totalBlisters = 0, totalProcessadores = 0, totalCaixas = 0;

  pedidoAtual.skus.forEach(sku => {
    if (sku.hardware === 'Memória RAM') {
      totalMemorias += sku.quantidade;
      totalBlisters += 1;
    } else if (sku.hardware === 'Processador') {
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

  const dadosSKU = skusJson.find(item => item.SKU.toUpperCase() === skuInput);

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

function irParaTelaSkus() {
  document.getElementById("telaInicio").classList.add("hidden");
  document.getElementById("telaSkus").classList.remove("hidden");
  carregarSKUs();
}
function carregarSKUs() {
  fetch('https://10.10.2.94:5501/skus')
    .then(res => res.json())
    .then(data => {
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

    const pendente = skusPendentes.some(p => p.SKU === sku.SKU);

    linha.innerHTML = `
      <td>${sku.SKU}${pendente ? " 🕒" : ""}</td>
      <td>${sku.hardware}</td>
      <td>${sku.modelo}</td>
      <td>${pendente ? '<span style="color: #f39c12;">Pendente</span>' : ""}</td>
    `;

    if (pendente) {
      linha.style.backgroundColor = "#fff3cd"; // Amarelo claro
    }

    tbody.appendChild(linha);
  }

  // Atualiza paginação
  const totalPaginas = Math.ceil(listaFiltradaSkus.length / itensPorPagina);
  document.getElementById("paginaAtual").textContent = `${paginaAtual} / ${totalPaginas}`;
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
    alert('Nenhum SKU para enviar.');
    return;
  }

  fetch('https://10.10.2.94:5501/salvar-skus', {  // <- Nome correto da rota que usa MySQL
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(skusPendentes)  // <- Envia um único SKU, pois a rota salva um por vez
  })
    .then(res => {
      if (!res.ok) throw new Error("Erro ao enviar SKU.");
      return res.text();
    })
    .then(msg => {
      alert(msg);
      skusPendentes.shift(); // Remove o primeiro da fila
      mostrarSkusPendentes();
    })
    .catch(err => {
      console.error(err);
      alert('Erro ao salvar SKU: ' + err.message);
    });

  mostrarAviso("✅ SKUs pendentes enviados com sucesso!", "#2ecc71");
  atualizarListaPendentes(); // Atualiza a lista pendente
  renderizarTabela(); // Atualiza a tabela após enviar
}

function mostrarSkusPendentes() {
  const container = document.getElementById('skusPendentes');
  container.innerHTML = '';

  if (skusPendentes.length === 0) {
    container.innerHTML = '<i>Nenhum SKU pendente para adicionar.</i>';
    return;
  }

  skusPendentes.forEach((sku, i) => {
    const div = document.createElement('div');
    div.textContent = `${sku.SKU} - ${sku.hardware} - ${sku.modelo} `;
    // Botão para remover pendente
    const btnRemover = document.createElement('button');
    btnRemover.textContent = '❌';
    btnRemover.onclick = () => {
      skusPendentes.splice(i, 1);
      mostrarSkusPendentes();
    };
    div.appendChild(btnRemover);
    container.appendChild(div);
  });
}

function adicionarSkuPendente() {
  const codigo = document.getElementById('novoSkuCodigo').value.trim();
  const hardware = document.getElementById('novoSkuHardware').value;
  const modelo = document.getElementById('novoSkuModelo').value.trim();

  // Validação básica
  if (!codigo || !modelo) {
    alert('Preencha todos os campos');
    return;
  }

  // Evita duplicados no pendentes
  if (skusPendentes.some(sku => sku.SKU === codigo)) {
    alert('SKU já adicionado nos pendentes!');
    return;
  }

  // Adiciona ao array
  skusPendentes.push({ SKU: codigo, hardware, modelo });

  // Atualiza visual na tela dos pendentes
  mostrarSkusPendentes();

  // Limpa campos
  document.getElementById('novoSkuCodigo').value = '';
  document.getElementById('novoSkuModelo').value = '';
}

function filtrarTabelaSkus() {
  const termo = document.getElementById("pesquisaSku").value.toLowerCase();
  listaFiltradaSkus = listaCompletaSkus.filter(sku =>
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
    const response = await fetch(`/api/excluir-sku/${encodeURIComponent(sku.SKU)}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      }
    });

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

function voltarInicio() {
  document.getElementById("telaSkus").classList.add("hidden");
  document.getElementById("telaInicio").classList.remove("hidden");
}

document.getElementById("btnNovoSKU").addEventListener("click", irParaTelaSkus);

function salvarSKUs() {
  const skusCustomizados = JSON.parse(localStorage.getItem("skusCustomizados") || "[]");

  if (!skusCustomizados.length) {
    mostrarAviso("⚠️ Nenhum SKU personalizado para salvar.", "#f39c12");
    return;
  }

  fetch("/salvar-skus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skusCustomizados)
  })
    .then(res => {
      if (!res.ok) throw new Error("Erro ao salvar SKUs.");
      return res.text();
    })
    .then(() => {
      mostrarAviso("✅ SKUs salvos no servidor com sucesso!", "#2ecc71");
      localStorage.removeItem("skusCustomizados");
      carregarSKUs();
    })
    .catch(err => {
      mostrarAviso("❌ Falha ao salvar SKUs.", "#e74c3c");
      console.error(err);
    });
}
