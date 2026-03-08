

# Página de Correção de Simulados

## O que será construído

Uma nova aba **"Correção"** dentro da página `/simulados`, permitindo ao aluno navegar questão a questão do simulado finalizado, ver se acertou/errou, conferir o gabarito e comentário do professor, e adicionar questões ao Caderno de Erros -- tudo numa experiência premium, fluida e intuitiva, inspirada na referência visual enviada.

## Estrutura

### Nova aba em `Simulados.tsx`
Adicionar terceira aba: **Simulados | Desempenho | Correção** (`grid-cols-3`). A aba "Correção" usa ícone `ClipboardCheck`.

### Novo componente: `src/pages/SimuladoCorrecao.tsx`

Experiência full-page de correção com:

**1) Header com seletor de simulado + stats resumidos**
- Selector do simulado (mesmo padrão do Desempenho)
- 4 KPI cards inline: Visualizadas, Acertos, Erros, Puladas (como na referência)
- Botão "Baixar em PDF" (reutiliza lógica existente do Desempenho)

**2) Barra de navegação de questões**
- Grid horizontal scrollável com números de questão
- Cores por status: verde (acerto), vermelho (erro), cinza (não respondida), ícone olho riscado (não visualizada ainda nesta sessão)
- Questão atual destacada com fundo primary
- Setas de navegação lateral (< >)
- Keyboard: setas esquerda/direita para navegar

**3) Card da questão (corpo principal)**
- Badge de resultado: "Correto!" (verde) ou "Incorreto" (vermelho) ou "Não respondida" (amber) ou "Anulada" (purple)
- Toggle "Exibir Comentário" colapsável (como na referência)
- Enunciado completo com imagem (se houver)
- Alternativas com visual de gabarito: verde = correta, vermelho = resposta errada do aluno, neutro = demais
- Comentário do professor (dentro do collapse)
- Badges de metadata: dificuldade, grande área, tema

**4) Botão do Caderno de Erros**
- Reutiliza `AddToErrorNotebookButton` + `AddToErrorNotebookDrawer` existentes
- Passa metadados automaticamente: `grande_area`, `especialidade`, `tema` da questão (dados reais, não null como hoje no QuestionModal)
- Visível para TODAS as questões (certas e erradas)

### Data fetching
- Busca questões via `questoes_simulado` (enunciado, alternativas, gabarito, comentário, imagem, metadata)
- Busca respostas do aluno via `answer_progress`
- Merge client-side para determinar acerto/erro por questão
- Reutiliza lógica já existente em `handleDownloadProvaRevisada` (linhas 494-672 do SimuladoDesempenho)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/pages/SimuladoCorrecao.tsx` | Criar -- página completa de correção |
| `src/pages/Simulados.tsx` | Editar -- adicionar terceira aba "Correção" |

## Detalhes técnicos

- Componente puro, sem novas dependências
- Dados carregados ao selecionar simulado, com cache em sessionStorage
- Navegação por teclado (setas) para trocar questão
- Mobile-first: cards empilhados, barra de questões scrollável horizontal
- Skeleton loading enquanto carrega questões
- Estado "Selecione um simulado" como empty state inicial
- Reutiliza `ErrorNotebookButtonInModal` pattern do SimuladoDesempenho para integração com Caderno de Erros, mas passando `grandeArea`, `especialidade` e `tema` reais da questão

