# Baseline de testes antes do Bloco A (Engajamento SanarFlix)

- **Data da medição:** 2026-10-23
- **Commit:** `ffc14429c616780b6c6d3a97582768f7f981ff02` (branch `feat/engajamento-sanarflix`)
- **Comando:** `node node_modules/vitest/vitest.mjs run` (duração ≈ 254 s)
- **Critério das tarefas seguintes:** nenhuma falha **nova** em relação a esta lista.

## Resumo

```
Test Files  11 failed | 126 passed (137)
Tests  40 failed | 1679 passed | 3 skipped (1722)
```

## Arquivos com falha (contagem de casos)

- `src/features/gestor/__tests__/CascataDiagnostico.test.tsx`: 17
- `src/test/unit/gestorMigrationsAcessoPorPapel.test.ts`: 8
- `src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts`: 5
- `src/features/gestor/__tests__/contratoEnvelopeRpc.test.ts`: 2
- `src/features/gestor/__tests__/VisaoGeral.test.tsx`: 2
- `src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts`: 1
- `src/features/gestor/__tests__/regua-unica.test.ts`: 1
- `src/features/gestor/__tests__/a11y.test.tsx`: 1
- `src/features/gestor/__tests__/GestorShell.test.tsx`: 1
- `src/features/gestor/__tests__/Direcionadores.test.tsx`: 1
- `src/features/gestor/__tests__/Detalhamento.test.tsx`: 1

## Casos que falharam

```
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > a cascata aberta por um card lista só as grandes áreas daquele nível
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > a cascata do nível excelente traz a área excelente e nenhuma crítica
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > a cascata para no 2º nível: a especialidade abre o drawer de temas, repassando a grande área do nó pai
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > a grande área repassada é a do ramo aberto, não uma constante: Cirurgia e Clínica Médica produzem valores diferentes
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > a linha de especialidade anuncia "Ver temas"; a de grande área, não
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > a seta divide o grid em dois e a cascata aparece AO LADO, não em drawer
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > as setas alcançam também os filhos do ramo aberto
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > cada nó da cascata mostra o nível de desempenho, não apenas o percentual
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > expande a especialidade no lugar, é accordion exclusivo e o segundo clique recolhe
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > grupo crítico vazio — caminho principal (§4.4, 87,9% dos recortes) > a cascata continua abrindo pelo card crítico mesmo com o resumo vazio — vazio não é erro
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > grupo crítico vazio — caminho principal (§4.4, 87,9% dos recortes) > aponta por onde começar: lista as áreas medianas ordenadas da pior para a melhor
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > marca cobertura parcial na pílula e mantém o n FORA dela, como metadado
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > o cabeçalho da cascata traz a trilha do ramo aberto
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > setas ↑ ↓ movem o foco entre os nós visíveis da árvore
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > só busca a cascata depois de abrir: nenhuma chamada de nível raiz antes do clique
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > troca o glifo do disclosure entre chevron_right e expand_more, sem rotação
src/features/gestor/__tests__/CascataDiagnostico.test.tsx > CascataDiagnostico > trocar o recorte recolhe a cascata
src/features/gestor/__tests__/Detalhamento.test.tsx > Rota Detalhamento — 1 simulado (§4.7.3) > faz a leitura completa e põe as questões como último componente da página
src/features/gestor/__tests__/Direcionadores.test.tsx > SaudacaoGestor (spec §2.1) > o título de tela tem a escala da referência, não a do Tailwind
src/features/gestor/__tests__/GestorShell.test.tsx > GestorShell (spec §8.3) > sidebar de 240px com lockup de altura mínima 48px (claro e escuro) e conteúdo rolável
src/features/gestor/__tests__/VisaoGeral.test.tsx > rota VisaoGeral > abrir o drawer de temas pela cascata não desmonta o resto da tela e repassa a grande área do nó pai
src/features/gestor/__tests__/VisaoGeral.test.tsx > rota VisaoGeral > clicar em "Exportar recorte" no DrawerTemas gera um arquivo CSV de verdade e confirma (achados 1 e 3 · auditoria 09/08 B4)
src/features/gestor/__tests__/a11y.test.tsx > acessibilidade — gráficos têm nome acessível e alternativa tabular (§11) > todo gráfico expõe role="img" com nome, dentro de <figure>, com tabela alternativa colapsável
src/features/gestor/__tests__/contratoEnvelopeRpc.test.ts > contrato do envelope: o que a tela lê é o que o SQL emite > a migration que acrescenta `alunos` existe no repositório e emite a chave
src/features/gestor/__tests__/contratoEnvelopeRpc.test.ts > contrato do envelope: o que a tela lê é o que o SQL emite > get_gestor_detalhamento emite as chaves que o Detalhamento consome
src/features/gestor/__tests__/regua-unica.test.ts > régua única de desempenho no produto (spec §4.4, §7.3 — Task 64b + Task 64) > nenhum arquivo de src/features/gestor reimplementa corte de nível fora de regras.ts
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > descobre exatamente as onze RPCs do portal — se este número mudar, a varredura abaixo mudou de escopo
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > get_gestor_detalhamento mantem papel -> resolucao de v_ies -> gestor_pode_acessar_ies, nessa ordem
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > get_gestor_detalhamento preserva SECURITY DEFINER, STABLE e search_path
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > get_gestor_visao_geral mantem papel -> resolucao de v_ies -> gestor_pode_acessar_ies, nessa ordem
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > get_gestor_visao_geral preserva SECURITY DEFINER, STABLE e search_path
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > nenhuma das onze chama user_has_feature (nem a variante sem _for_ies)
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > nenhuma das onze chama user_has_feature_for_ies
src/test/unit/gestorMigrationsAcessoPorPapel.test.ts > acesso por papel nas onze RPCs get_gestor_* (gestao.enabled removida, 07/08) > nenhuma das onze menciona gestao.enabled
src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts > guard de feature nas RPCs get_gestor_* — gestao.portal_v2 nunca volta (GA total, 06/08) > descobre as onze RPCs do portal — se este número mudar, a varredura abaixo mudou de escopo
src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts > guard de feature nas RPCs get_gestor_* — gestao.portal_v2 nunca volta (GA total, 06/08) > get_gestor_detalhamento vigente nunca chama a feature morta gestao.portal_v2 (removida no GA total; gestao.enabled também saiu em 07/08, mas por decisão de produto, não por ser "morta")
src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts > guard de feature nas RPCs get_gestor_* — gestao.portal_v2 nunca volta (GA total, 06/08) > get_gestor_detalhamento vigente preserva SECURITY DEFINER, STABLE e search_path
src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts > guard de feature nas RPCs get_gestor_* — gestao.portal_v2 nunca volta (GA total, 06/08) > get_gestor_visao_geral vigente nunca chama a feature morta gestao.portal_v2 (removida no GA total; gestao.enabled também saiu em 07/08, mas por decisão de produto, não por ser "morta")
src/test/unit/gestorMigrationsAvisosAlunoContatoContexto.test.ts > guard de feature nas RPCs get_gestor_* — gestao.portal_v2 nunca volta (GA total, 06/08) > get_gestor_visao_geral vigente preserva SECURITY DEFINER, STABLE e search_path
src/test/unit/gestorMigrationsGetUserIesIdFallback.test.ts > get_user_ies_id() - fallback para gestor_grupo > a versão vigente é a migration 20260811141000
```
