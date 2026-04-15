

# Gerar snippet HTML standalone do Dashboard de Desempenho

## Objetivo
Criar um arquivo HTML autocontido (sem dependências externas) que replica visualmente a tela do Painel de Desempenho do print, para ser colado como seção em uma landing page do HubSpot.

## Escopo
- Um único arquivo HTML com CSS inline/embarcado e zero JavaScript necessário
- Replica todos os elementos visíveis: header com título + badge, barra de filtros (decorativa), alerta de sanção, abas de navegação, 8 KPI cards (2 linhas de 4), e 3 cards de distância por faixa
- Responsivo (grid adapta para mobile)
- Fontes: Inter (Google Fonts) para fidelidade visual
- Todas as cores, bordas laterais coloridas nos cards, ícones via SVG inline (sem Lucide dependency)

## Entrega
- Arquivo gerado em `/mnt/documents/dashboard-mock-snippet.html`
- Pronto para copiar o conteúdo e colar no módulo HTML do HubSpot

## Detalhes visuais replicados
- Header: "Painel de Desempenho" bold + subtítulo "53.3% dos alunos proficientes · faltam 8 para a próxima faixa" + badge amarelo "Atenção necessária"
- Filtros: dropdowns decorativos (TESTE_IES, TESTE_Simulado) + chips (Áreas, Especialidades, Semestres, Temas)
- Alerta: fundo amarelo claro com ícone warning + texto sanção
- Tabs: 5 abas com "Visão Institucional" ativa
- KPI Row 1: Total de Alunos (120), Percentual de Acertos (59%), Proficiência Média TRI (59), Alunos Proficientes (53.3%) — bordas laranja
- KPI Row 2: Nota Prevista (Conceito 2, borda vermelha), Distância Próxima Faixa (6.7 p.p., borda laranja), Alunos Abaixo (56, borda laranja), Taxa de Adesão (100%, borda verde)
- Distância cards: 3 cards com ícones e cores distintas (verde, cinza, vermelho)

