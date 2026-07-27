# Fase 4 — Diagnóstico Curricular (dentro da Visão Geral)

Hierarquia obrigatória: **grande área → especialidade → tema**. Áreas e temas usam **% de acerto**, nunca proficiência.

**Entregar:**

1. **Resumo por nível de desempenho**: três grupos — *excelente*, *mediano*, *crítico* — com chips de grande área e % de acerto. Cada chip é foco/teclado acessível.

2. **Cascata** (`CascataDiagnostico`):
   - abre **ao lado** do resumo, dividindo o grid em dois (a seta indica a direção);
   - accordion **exclusivo** de 2 níveis: grande área → especialidade;
   - expande **abaixo do nó** (não é drawer), cabeçalho e trilha fixos;
   - carrega o nível seguinte sob demanda (`GET /gestor/diagnostico?node=`);
   - por nó: % de acerto, nível de desempenho, badge `cobertura parcial` quando `lowSample`;
   - `aria-expanded`, navegação por setas, transição `motion-4`.

3. **Drawer de temas** (`DrawerTemas`): abre a partir da **especialidade**; lista temas com % de acerto e barra; `cobertura parcial` por tema; rodapé com *Exportar recorte* e *Copiar resumo* (nunca a base inteira). Foco preso, ESC fecha, foco volta ao gatilho.

**Estados:** loading por nível, vazio ("nada a exibir neste recorte"), erro com retry, `lowSample`.

**Aceite:** nunca dois ramos abertos; responsivo ao dividir o grid; % sempre visível (não depender do eixo); `axe` limpo.
