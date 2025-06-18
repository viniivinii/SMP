## 💻 Sistema de Separação de Memórias RAM (SMP)

Projeto interno da empresa **GAG Reciclagem de Eletrônicos**, desenvolvido para otimizar o processo de separação, embalagem e expedição de memórias RAM e processadores.

A aplicação permite que operadores cadastrem pedidos, organizem SKUs conforme a capacidade de blisters ou caixas, e acompanhem todo o fluxo com rastreabilidade completa — desde o início da separação até a geração de relatórios em PDF.

---

## 📦 Gestão de Pedidos

- Numeração única para cada pedido com controle individual
- Validação automática de campos obrigatórios
- Prevenção de duplicidade de pedidos

---

## 🧠 Cadastro de SKUs

- Detecção automática do tipo de hardware (Memória RAM ou Processador)
- Cálculo inteligente de embalagens com base na capacidade (25 unidades por blister ou 22 com dissipador)
- Suporte a memórias com dissipador

---

## 🖨️ Geração de Etiquetas

- Impressão de etiquetas com código de barras
- Organização por blister ou caixa para facilitar a expedição

---

## 🧾 Histórico e Relatórios

- Visualização completa do histórico de pedidos
- Tempo total de separação por pedido
- Exportação em PDF com resumo de SKUs, quantidades, datas e embalagens utilizadas
- Cards visuais com totais por categoria (memórias, processadores, embalagens)

---

## ✅ Validações Inteligentes

- Agrupamento automático de SKUs iguais no mesmo pedido
- Impedimento de finalização de pedidos incompletos
- Restrições de formato para campo SKU (formato padrão: `PC0000`)

---

## 🖼️ Interface

- Interface amigável e responsiva com foco em usabilidade
- Layout escuro com destaques visuais para ações importantes
- Animações suaves e cards informativos em tempo real
- Logotipo institucional no topo da aplicação

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS)
- **Backend**: Node.js com Express
- **Banco de Dados**: MySQL
- **PDF**: jsPDF para exportação de relatórios

---

Sistema desenvolvido com foco em **eficiência operacional**, **rastreabilidade** e **padronização dos processos logísticos internos**.

> **Dev**: Vinicius Eduardo – GAG Reciclagem de Eletrônicos
