# API de Mentoria · contrato v1 (14/10/2026)

Servida pelo Academy (Supabase Edge Function `mentoria-api`), consumida pela
Página do Mentorando no SanarFlix PRO ENAMED (Flix), sempre via Kong.

## Autenticação

Chamada só server-to-server, nunca do navegador ou do app. O Flix chama o Kong;
o Kong chama a edge function. A function não tem CORS e não valida JWT
(`verify_jwt = false`): a credencial é a chave do Kong.

| Header | Quem põe | Uso |
| --- | --- | --- |
| `x-mentoria-key` | Kong (injeta) | Segredo `MENTORIA_API_KEY` no Supabase, comparado em tempo constante. Ausente ou diferente → `401 nao_autorizado`. |
| `x-aluno-email` | Flix, via Kong | E-mail do aluno logado. É a identidade do aluno (normalizado em minúsculas, sem espaços, igual a `email_normalizado` do vínculo). Ausente → `400 aluno_ausente`. |
| `x-sanarflix-user-id` | Flix, via Kong | `userId` do Flix. Só é registrado em log, não decide nada. |

Rotas no edge: `/me`, `/mural`, `/sessoes` (o prefixo `/mentoria-api` é aceito e
ignorado). Só `GET`; outro método → `405`. O Kong expõe como `/mentoria/…`.

## Rotas

### GET /mentoria/me
Quem é o mentor atual do aluno (vínculo ativo) e se a agenda dele está liberada.

```json
{
  "tem_mentor": true,
  "mentor": {
    "nome": "Thiago Taniguchi",
    "foto_url": "https://…",
    "formacao": "Residente em …",
    "turma_nome": "Tribo Carcará",
    "link_agendamento": null
  },
  "agendamento_liberado": false,
  "mensagem_liberacao": null
}
```
`tem_mentor: false` → `mentor` vem `null`, `agendamento_liberado: false`. O que
mostrar nesse caso (onboarding) é decisão do Flix, fora desta API.
`link_agendamento` só vem preenchido quando o mentor liberou a agenda para o
aluno (`agendamento_liberado: true`, com a `mensagem_liberacao` do mentor).

### GET /mentoria/mural?aba=coletivo|pra-voce&cursor=…
```json
{
  "itens": [
    {
      "id": "uuid",
      "tag": "texto livre definido pelo mentor (ex.: Desempenho, Aviso, Fique por dentro)",
      "titulo": "…",
      "mensagem": "…",
      "link": { "titulo": "…", "url": "https://…" },
      "anexo": { "nome": "…", "url": "https://… (assinada, 1h)" },
      "publicado_em": "2026-10-08T12:00:00-03:00"
    }
  ],
  "proximo_cursor": null,
  "tem_pra_voce": true
}
```
`link` e `anexo` vêm `null` quando o post não tem. Só posts publicados do mentor
atual do aluno. `coletivo` = posts para a turma; `pra-voce` = posts em que o
aluno é destinatário. Página de 20, do mais novo ao mais antigo;
`proximo_cursor` (timestamp ISO, ex.: `2026-10-08T15:00:00+00:00`) é `null` na
última página e vai de volta em `?cursor=` para buscar a seguinte. O `cursor`
deve ir codificado na URL (o `+` do offset vira `%2B`; sem isso o servidor lê
espaço e responde `400 parametro_invalido`). `tem_pra_voce: false` → a aba "Pra você" não
aparece. Sem mentor: `itens: []`, `tem_pra_voce: false`.

### GET /mentoria/sessoes?quando=proximas|realizadas
```json
{
  "itens": [
    {
      "id": "uuid",
      "tipo": "coletiva | individual",
      "titulo": "…",
      "mentor_nome": "…",
      "inicio": "2026-10-15T19:00:00-03:00",
      "meet_link": "https://meet.google.com/…",
      "gravacao_url": null
    }
  ]
}
```
Próximas: do mentor atual do aluno, agendadas e a partir de agora; as coletivas
mais a individual do próprio aluno (nunca a de outro). Realizadas: coletivas de
todos os mentores com gravação, mais o arquivo 2025 (sem mentor: `mentor_nome`
`null`), até 200, da mais recente para a mais antiga; `meet_link` vem `null`
(substitui o payload do toggle `sanarflix-mentorships-upcoming`). Próximas
vêm em ordem crescente de `inicio`.

### Onboarding (escolha de tribo)
**Fora desta API.** Decisão de 13/10: o onboarding e a escolha de tribo ficam no
SGI. O vínculo aluno × mentor chega ao Academy pela tabela de alunos
sincronizada pelo time de dados; esta API só lê o vínculo ativo.

## Erros
Corpo: `{ "erro": "codigo", "mensagem": "texto em pt-BR" }`.

| Status | `erro` | Quando |
| --- | --- | --- |
| 400 | `aluno_ausente` | Falta `x-aluno-email`. |
| 400 | `parametro_invalido` | `aba` fora de `coletivo\|pra-voce`, `quando` fora de `proximas\|realizadas`, ou `cursor` que não é data ISO. |
| 401 | `nao_autorizado` | Falta `x-mentoria-key` ou ela não confere. |
| 404 | `rota_inexistente` | Rota que não é `/me`, `/mural` ou `/sessoes`. |
| 405 | `metodo_nao_permitido` | Método diferente de GET. |
| 500 | `erro_interno` | Falha inesperada; sem detalhe no corpo. |

Limite de taxa (`429`), se existir, é aplicado pelo Kong.

## Em aberto
1. Domínios de CORS: não se aplica (server-to-server).
2. Paginação do mural: cursor (definido acima).
