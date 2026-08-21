# Bloqueio por saída de aba no simulado — exclusivo Claretiano

**Data:** 2026-08-21
**Origem:** pedido da Ana Luiza Grilo (Claretiano), via WhatsApp: "Se o aluno sair da página mais de 1x, podemos combinar dele ser bloqueado? Até 1x considero que possa ter sido necessário por algum motivo, mas mais de uma vez é cola."

## Regra de negócio

Para alunos de IES na lista de bloqueio (hoje só Claretiano, `ies.id = 6029b69d-a2ef-4de5-b907-91f88122bb4e`):

- **1ª saída da página** durante o modo prova: tolerada. Aluno vê aviso persistente de que a próxima saída bloqueia o simulado.
- **2ª saída em diante**: simulado é **finalizado automaticamente na hora** com a flag `bloqueado_por_saidas = true`. As respostas dadas até ali são corrigidas e contam. O aluno vê tela de bloqueio ("você saiu da página mais de uma vez") e não consegue reentrar.
- Ao abrir o simulado, aluno de IES estrita vê um aviso das regras antes de começar a responder.
- **Escape hatch**: o fluxo existente de "liberar novamente" no admin (`liberado_novamente`) continua funcionando para reverter falsos positivos.

Alunos de qualquer outra IES: comportamento atual inalterado (contagem de saídas apenas informativa).

## Detecção

Reusa o mecanismo existente: `useFocusControl` (visibilitychange) → `onSaidaAba` → `useSimuladoStorage.registrarSaidaAba()`. A contagem continua em localStorage (mesmo nível de confiança do anti-cheat atual; simulado é presencial e fiscalizado). O bloqueio vira server-side no momento em que dispara: a finalização grava em `simulados_finalizados`, que já é o que impede reentrada.

## Mudanças

1. **DB (gvqv):** `alter table simulados_finalizados add column bloqueado_por_saidas boolean not null default false;` — migration no repo + aplicada em prod via MCP.
2. **Edge function `corrigir-simulado`:** aceita `bloqueado_por_saidas?: boolean` no body e persiste na insert de `simulados_finalizados`. Backward compatible (default false). Redeploy com `verify_jwt: false` (como está em prod — necessário para o fluxo sendBeacon).
3. **Frontend:**
   - `src/config/antiCola.ts` (novo): lista de IES com bloqueio + limite (1) + helpers.
   - `useSimuladoStorage.registrarSaidaAba()` passa a retornar a nova contagem.
   - `ModoProva`: dialog inicial de regras (IES estrita), aviso persistente após a 1ª saída, bloqueio + auto-finalização na 2ª, tela de bloqueio, payload do sendBeacon com a flag, mensagem específica na tentativa de reentrada.
   - `simuladosApi`: flag no `enviarResultado`; status de finalização passa a expor `bloqueadoPorSaidas`.
   - Admin (aba Liberações): badge "Bloqueado por saídas" na linha da finalização.

## O que decidimos NÃO fazer

- Contador server-side por evento de saída (RPC a cada visibilitychange): complexidade alta para ganho marginal — o aluno que limpar localStorage perde as próprias respostas e o deadline individual, e a prova é presencial.
- Zerar a nota do bloqueado: a regra pedida é "perdeu a oportunidade" (não continua), não anulação retroativa do que já respondeu. Gestor enxerga a flag e decide.
