#💻 Sistema de Separação de Memórias RAM (SMP)

Projeto interno desenvolvido para otimizar o processo de separação, embalagem e expedição de memórias RAM e processadores na empresa GAG Reciclagem de Eletrônicos.

A aplicação permite que operadores cadastrem pedidos, organizem os SKUs conforme a capacidade de blisters ou caixas, e acompanhem todo o processo com rastreabilidade completa — do início da separação até a geração de relatórios em PDF.

📌 Funcionalidades Principais:
#📦 Gestão de Pedidos

◦ Início de pedidos com numeração única e controle individual

◦ Validação automática para evitar duplicatas e campos vazios

#🧠 Cadastro de SKUs

◦ Identificação automática do tipo de hardware (Memória RAM ou Processador)

◦ Cálculo dinâmico da quantidade de embalagens necessárias

◦ Suporte a memórias com dissipador (ajuste de capacidade de blisters)

#🖨️ Geração de Etiquetas

◦ Criação de etiquetas com código de barras para cada embalagem

◦ Impressão rápida e organizada por blister ou caixa

#🧾 Histórico e Relatórios

◦ Visualização do tempo de separação por pedido

◦ Exportação completa em PDF com resumo de quantidades, SKUs e datas

◦ Cards visuais para total de itens, embalagens, memórias e processadores

#✅ Validações Inteligentes

◦ Agrupamento automático de SKUs iguais

◦ Impede finalização de pedidos incompletos

◦ Restrições de formato no campo SKU (prefixo PC + números)

#🖼️ Interface
◦ Interface intuitiva com animações suaves

◦ Layout escuro com foco visual em ações importantes

◦ Cards informativos em tempo real

◦ Logo da empresa no topo como identificação institucional

#🛠️ Tecnologias Utilizadas
◦ Frontend: HTML5, CSS3, JavaScript puro (Vanilla JS)

Bibliotecas:

jsPDF – exportação de relatórios em PDF

Armazenamento via MySQL

Desenvolvido com foco em eficiência operacional, rastreabilidade e padronização interna.

DEV: Vinicius – GAG Reciclagem
