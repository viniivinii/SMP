# 💻 Sistema de Separação de Memórias RAM

Projeto interno da empresa **[Nome da sua empresa]** para controle e organização da separação de memórias RAM por SKU, com geração de etiquetas, controle por pedido e histórico.

## 📌 Funcionalidades

- Início de pedidos com numeração única
- Cadastro de SKUs com cálculo automático de blisters
- Suporte a dissipador com ajuste de cálculo
- Geração e impressão de etiquetas com código de barras
- Histórico de pedidos com tempo de separação
- Exportação de relatórios em PDF
- Validações inteligentes:
  - SKUs duplicados são somados
  - Não permite finalizar pedidos vazios
  - Valida se o número do pedido já foi usado
  - Campo SKU só aceita números (prefixo `PC` automático)

## 🖼️ Interface

- Interface intuitiva com animações suaves
- Layout escuro com realce visual para seções importantes
- Logo da empresa exibida no canto superior esquerdo

## 🛠️ Tecnologias Utilizadas

- HTML5 + CSS3 (com estilos personalizados)
- JavaScript puro (Vanilla JS)
- [JsBarcode](https://github.com/lindell/JsBarcode) para geração de código de barras
- [jsPDF](https://github.com/parallax/jsPDF) para exportação em PDF
- Armazenamento local via `localStorage` (persistência offline)

Desenvolvido por Vinicius – GAG.
