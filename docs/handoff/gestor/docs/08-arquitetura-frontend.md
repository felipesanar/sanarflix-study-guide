# 08 · Arquitetura frontend

## Rotas

```
/gestor                      Início
/gestor/visao-geral          Visão Geral (Diagnóstico e Alunos vivem dentro dela)
/gestor/detalhamento         Detalhamento por Simulados
```

Estado que precisa ser compartilhável vai na **URL** (query string), não em contexto global:

```
/gestor/visao-geral?semestre=6ano
/gestor/detalhamento?semestre=11&simulados=SN1,SN2&ordem=mais-erradas&area=pediatria
```

Vantagens: link colável, voltar/avançar funcionam, refresh preserva o recorte, telemetria fica trivial.

## Estrutura de pastas sugerida

```
src/features/gestor/
├── routes/            Início.tsx, VisaoGeral.tsx, Detalhamento.tsx
├── components/        KpiCard, FiltroSemestre, SeletorSimulados, CascataDiagnostico,
│                      DrawerTemas, DrawerAluno, TabelaAlunos, TabelaQuestoes,
│                      AcertoPorAreaESemestre, ComparativoSimulados, Cronograma…
├── charts/            EvolucaoChart, AreasChart, DispersaoChart, DistribuicaoAlternativas
├── hooks/             useFiltrosGestor, useVisaoGeral, useDetalhamento, useDiagnostico…
├── api/               client.ts, queries.ts, types.ts (espelha contracts/types.ts)
├── lib/               formatters.ts, regras.ts (proficiente>60, variação, ENAMED)
└── __tests__/
```

## Estado

| Escopo | O que guarda |
|---|---|
| **URL** | `semestre`, `simulados[]`, ordenação, filtro de área, aluno aberto |
| **React Query** | Todo dado remoto, chaveado pelos filtros |
| **Local (useState)** | Nó expandido da cascata, drawer aberto, hover/seleção de gráfico |
| **Contexto** | Apenas tema/brand e usuário/permissões |

Nada de Redux para esta feature.

## Dados

- **React Query** com `queryKey: ['gestor', recurso, filtros]`, `staleTime` de 5 min, `keepPreviousData: true` (troca de filtro não pisca).
- **Cascata**: lazy por nível — só busca a especialidade quando a grande área abre.
- **Drawer**: busca sob demanda; enquanto isso, skeleton no painel.
- **Prefetch**: ao passar o mouse no card de direcionamento do Início, `prefetchQuery` da Visão Geral.
- **Erro**: `retry: 1` + botão "Tentar novamente" que refaz só a query daquele bloco.

## Performance

- Code-split por rota; `charts/` em chunk separado (lib de gráfico é pesada).
- Virtualização (`@tanstack/react-virtual`) em qualquer tabela acima de 100 linhas.
- Memoizar linha de tabela e ponto de gráfico; evitar recriar handlers no map.
- Agregações **no backend** (materialized views por instituição × semestre × simulado × grande área × especialidade × tema). O front nunca soma base bruta.
- Orçamento: LCP < 2.5s, INP < 200ms, JS inicial da rota < 250 KB gzip.

## Tema

`ThemeProvider` do Dendê com `data-brand="flix"`. O tema escuro entra como **camada de tokens** (`tokens/tokens.dark.css`) sob `[data-theme="dark"]` — nunca como inversão de filtro. Preferência do usuário persistida e sincronizada com `prefers-color-scheme` na primeira visita.

## Erros e resiliência

- **Error boundary por bloco**, não por página: um gráfico quebrado não derruba a tela.
- Timeout de rede com mensagem específica; nunca spinner infinito.
- Toda mutação (marcar aviso como lido, exportar) é idempotente e otimista com rollback.
