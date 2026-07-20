## Contexto

Na aba **Visão de Alunos** (`/gestor/alunos`), a lista mistura alunos com `triScore` calculado e alunos sem TRI (que caem no fallback `s.percentual`) sem distinção visual. Hoje o valor à direita usa sempre a cor de status de proficiência, o que induz o usuário a interpretar o `%` de acertos como se fosse um Score TRI.

O sinal de "IES já teve TRI calculado" já existe no ViewModel: `data.headerSummary.triPending` (true = nenhuma nota TRI da IES ainda; conceito indisponível) e `data.headerSummary.conceitoScoped` (null quando não há conceito).

## Escopo (apenas front-end, item 1 de 2)

Arquivo único: `src/components/analytics/v2/modules/VisaoAlunosModule.tsx` — bloco de renderização de cada aluno (a partir da linha ~295, dentro do map de `sortedStudents`).

## Regras de UI a aplicar

Para cada aluno na lista, quando `hasTri === false` (isto é, `s.triScore` é `null`/`undefined`):

1. **Substituir o badge de status** ("Abaixo da proficiência", "Próximo…", "Proficiente") por um badge cinza claro (neutro, pouco chamativo), com texto:
   - `"TRI em Calibração — Mostrando % de Acertos"` quando a IES ainda não teve conceito calculado, sinalizado por `data.headerSummary.triPending === true` (ou `conceitoScoped == null`).
   - `"Amostra Insuficiente — Mostrando % de Acertos"` caso contrário (a IES já tem conceito, mas este aluno específico não tem `triScore`).
2. **Esconder o badge auxiliar "X p/ virar"** quando `hasTri` é falso (esse gap não faz sentido sem TRI).
3. **Cor do valor à direita** (`scoreLabel`) passa a ser cinza neutro (`text-muted-foreground`) para alunos sem TRI. Alunos com TRI mantêm exatamente as cores atuais via `cfg.color`.

Alunos com `hasTri === true` permanecem inalterados (badge de status colorido + score colorido).

### Estilização do badge cinza

Usar tokens semânticos, sem hardcode: variante `outline` com `bg-muted/40 text-muted-foreground border-border` (mesmo peso visual de `text-[10px] px-1.5 py-0 h-5`). Sem ícone para reforçar o tom informativo/neutro.

## Fora de escopo

- Nenhuma mudança em RPC, mapper (`mapInstitutionalData.ts`) ou tipos.
- Nenhuma mudança nos cards de resumo do topo, filtros, ordenação, drawer de detalhes ou aba **Temas**.
- Item 2 do usuário será tratado em etapa separada, após aprovação deste.

## Verificação

Após a edição, checar visualmente em `/gestor/alunos` (com simulado sem TRI e com TRI parcial) que:
- Alunos sem TRI mostram badge cinza com o texto correto conforme `triPending`.
- Score `%` desses alunos aparece em cinza neutro.
- Alunos com TRI seguem idênticos ao comportamento atual.
