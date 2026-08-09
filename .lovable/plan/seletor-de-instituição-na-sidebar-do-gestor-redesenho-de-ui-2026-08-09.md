# Seletor de instituição na sidebar do gestor — redesenho de UI e UX

O cartão de IES na sidebar (`SidebarIes`) hoje é um `Select` genérico do shadcn com o nome da IES e um chevron: sem busca, sem agrupamento, sem indicação de qual está ativa na lista, sem estado de erro, e com a sigla (ex. "FFAI") como único elemento visual. Para admin ele lista as 24 instituições numa lista corrida — inutilizável na prática. Para o gestor de uma única IES o cartão vira um rótulo cinza sem informação nenhuma além do nome.

## O que muda

**1. Novo controle: painel de troca de instituição (não mais um `<select>`)**
- Gatilho: cartão com o tile da sigla, nome da IES em destaque, e uma linha de contexto abaixo (papel/escopo: "Todas as instituições", "Grupo · N instituições", ou o nome do contrato quando existir).
- Afordância clara de que abre algo: chevron + realce de hover/foco, com o cartão parecendo um botão de verdade (não um campo de formulário).
- O painel abre num popover ancorado, largura confortável (mais larga que a sidebar), com:
  - **campo de busca** com foco automático, filtrando por nome e por sigla, acento-insensível;
  - **lista de instituições** com tile de sigla, nome completo e marca de "selecionada" (check + faixa da marca);
  - **seção "Recentes"** no topo (últimas 3 IES visitadas, persistidas localmente por usuário) quando houver mais de 8 opções;
  - **estado vazio de busca** ("Nenhuma instituição encontrada para …" + ação de limpar);
  - **contador** no topo ("24 instituições disponíveis").
- Teclado completo: setas, Home/End, Enter para selecionar, Esc para fechar devolvendo o foco ao gatilho, digitar para buscar. Rolagem com altura máxima e a opção ativa visível ao abrir.

**2. Estados por papel**
- **admin** — painel com busca, contador e recentes; linha de contexto "Todas as instituições".
- **gestor_grupo** — mesmo painel; quando o grupo tem ≤ 8 IES, sem busca (a lista já cabe); linha de contexto "Grupo · N instituições".
- **gestor (uma IES)** — não é controle (mantém a regra atual: nada clicável, nada `disabled`), mas deixa de ser um rótulo apagado: mesmo tile, nome, e linha de contexto com o contrato/vigência quando o backend mandar. Sem chevron.

**3. Estados de carregamento, erro e transição**
- Skeleton com a mesma altura do cartão final (mantém a regra atual de não fazer a sidebar pular), agora com tile + duas linhas.
- **Estado de erro** (hoje inexistente: `!contexto` simplesmente renderiza nada, deixando um vão na sidebar): cartão discreto "Não foi possível carregar a instituição" com "Tentar novamente" chamando o `refetch` da query.
- Ao trocar de IES, o cartão entra em estado ocupado (nome + spinner discreto) até os dados da rota chegarem, e o painel fecha imediatamente — a troca é percebida como instantânea.
- Anúncio para leitor de tela ao trocar ("Instituição alterada para …").

**4. Regras preservadas (não mudam)**
- `podeTrocarIes` continua sendo o único switch — nenhuma checagem de papel literal no componente.
- `?ies=` continua sendo hint de UI; a validação contra `iesDisponiveis` e a semeadura a partir de `iesAtual` ficam como estão.
- Trocar de IES continua limpando `?simulados=`.
- Nenhum hex solto: só tokens `--gp-*`.

## Detalhes técnicos

- `src/features/gestor/shell/SidebarIes.tsx`: reescrito sobre `Popover` + `Command` (cmdk, já no projeto via `src/components/ui/command.tsx`) em lugar de `Select`, mantendo o `container` do portal do shell (`useGestorPortalContainer`) para o popover não escapar do escopo do tema.
- Extrair `TileIes`, `iniciaisDaIes` e as constantes de cartão para `src/features/gestor/shell/ies/` para reuso entre gatilho, itens e skeleton.
- Recentes em `localStorage` chaveado por `usuario.id` (`gp:ies-recentes:<uid>`), tolerante a JSON inválido.
- Tokens novos, se faltarem, adicionados em `gestor-theme.css` (superfície de item ativo/hover do painel) — nada de valor literal no componente.
- Testes: `SidebarIes.test.tsx` atualizado — os casos existentes (dropdown por papel, rótulo estático sem elemento clicável, escrita de `?ies=`, limpeza de `?simulados=`, validação de `?ies=` fora de escopo, altura estável do skeleton) continuam valendo com o novo controle, mais novos casos para busca, estado vazio de busca, erro com retry e navegação por teclado.
- Nenhuma mudança de banco, RPC ou edge function; nenhuma alteração no contrato `ContextoGestor`.
