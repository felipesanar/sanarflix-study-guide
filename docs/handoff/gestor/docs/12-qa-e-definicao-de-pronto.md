# 12 · QA e definição de pronto

## 1. Matriz de estados (obrigatória por componente)

| Componente | default | loading | empty | error | partial / low_sample | disabled |
|---|---|---|---|---|---|---|
| KpiCard | ✔ | skeleton com altura final | "sem dados no recorte" | bloco com retry | faixa "cobertura parcial" | — |
| Gráfico de evolução | ✔ | skeleton de eixos | eixos + mensagem | retry | nota de recorte parcial | — |
| Cascata | ✔ | skeleton do nível | "nada a exibir" | retry | badge no nó | — |
| DrawerTemas | ✔ | skeleton de lista | "sem temas críticos" | retry | badge por tema | — |
| Tabelas | ✔ | 5 linhas skeleton | vazio com ação | retry | `—` por célula | — |
| TabelaQuestoes | ✔ | skeleton | "sem questões" | retry | "gabarito em processamento" | ✔ |
| SeletorSimulados | ✔ | skeleton | "nenhum simulado realizado" | retry | — | previsto/processando |
| Comparativo | colapsado | skeleton | — | retry | — | — |

## 2. Casos de teste críticos (regras de negócio)

1. Proficiente é `> 60` — 60 **não** é proficiente.
2. Nota TRI não aparece em nenhum lugar da Visão Geral.
3. Conceito ENAMED nunca é média: com 2 simulados, aparecem dois valores.
4. Selecionar 0 simulados no Detalhamento → estado vazio, nenhuma requisição de métrica.
5. Selecionar 6 simulados → aviso não-bloqueante; a tela continua utilizável.
6. Com 2+ simulados, "Detalhamento das Questões" **não** é renderizado.
7. Aluno sem participação → `—` + "Não participou", fora de toda média.
8. `variacao` só existe quando o aluno participou de ambos.
9. Filtro "Por semestre" → controles multi-semestre somem; gráfico de comparação vira distribuição.
10. Filtro "6º ano" → 11º e 12º em evidência, demais esmaecidos.
11. Clique cruzado área ↔ semestre recalcula o outro eixo e o segundo clique limpa.
12. Filtro de semestre persiste ao navegar Visão Geral ↔ Detalhamento (e sobrevive ao refresh, via URL).
13. `gestor_ies` não recebe dropdown de IES; `admin_b2b` recebe.
14. Nenhuma tela exibe TRI, ENAMED ou proficiência aplicados a **tema/especialidade** (lá é % de acerto).

## 3. Testes por camada

- **Unidade**: formatadores (%, TRI, conceito, data), regras (`ehProficiente`, `calcularVariacao`, `agregarPorSimulado`), redutores de filtro.
- **Componente**: cada estado da matriz acima (Storybook + play functions ou Testing Library).
- **Integração**: tela completa com MSW usando `contracts/fixtures/`.
- **E2E** (Playwright): Início → Visão Geral → cascata → drawer → Detalhamento → seleciona 2 simulados → comparativo; e o caminho de erro (API 500 → retry).
- **Visual regression**: Chromatic ou Playwright screenshots — claro e escuro.
- **A11y**: `axe` em cada rota no CI + roteiro manual de teclado.

## 4. Performance (orçamento)

- LCP < 2.5s, INP < 200ms, CLS < 0.1 na Visão Geral com dados reais.
- Troca de filtro re-renderiza apenas os blocos afetados (verificar com Profiler).
- Tabela de 104 alunos e 100 questões rola a 60fps.

## 5. Definição de pronto (PR)

- [ ] Regras de `02-regras-de-negocio.md` cobertas por teste
- [ ] Todos os estados da matriz implementados e revisados no claro **e** no escuro
- [ ] Sem `any`, sem `@ts-ignore`, sem `console.log`, sem código morto
- [ ] `lint`, `typecheck`, `test`, `build` verdes
- [ ] `axe` sem violação séria/crítica; navegação por teclado validada
- [ ] Checklist de segurança de `10-seguranca-e-permissoes.md`
- [ ] Nenhum hex/px solto: tudo via token
- [ ] Screenshot claro/escuro no PR e comparação com o protótipo
