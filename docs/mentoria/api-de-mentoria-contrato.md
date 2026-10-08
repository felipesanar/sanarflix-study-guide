# API de Mentoria · contrato (rascunho v0, 08/10/2026)

Servida pelo Academy (Supabase Edge Function `mentoria-api`), consumida pela
Página do Mentorando no SanarFlix PRO ENAMED.

## Autenticação

- Header `Authorization: Bearer <ID token Cognito do aluno>`.
- A API valida a assinatura pelo JWKS do user pool e lê o claim `userId`
  (confirmado: igual ao `user.id` do `GET /user`).
- Alternativa em discussão: chamada via proxy no BFF, com credencial de
  serviço e o `userId` num header. Decidir na reunião de 13/10.

## Rotas

### GET /mentoria/me
Quem é o mentor do aluno e se ele precisa de onboarding.

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
`tem_mentor: false` → a página mostra o onboarding (escolha de tribo).

### GET /mentoria/mural?aba=coletivo|pra-voce&cursor=…
```json
{
  "itens": [
    {
      "id": "uuid",
      "tag": "desempenho | aviso | fique_por_dentro",
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
`tem_pra_voce: false` → a aba "Pra você" não aparece.

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
Próximas: só as do mentor do aluno. Realizadas: de todos os mentores
(substitui o payload do toggle `sanarflix-mentorships-upcoming`).

### Onboarding (escolha de tribo)
Não passa por esta API. Decisão de 08/10: o vínculo aluno × mentor mora no
SGI. O onboarding do Flix grava a escolha no SGI e ela chega ao Academy pela
tabela de alunos sincronizada pelo time de dados. Em aberto para 13/10: o SGI
já tem esse campo ou precisa de tabela nova no banco do Flix?

## Erros
`401` token inválido · `404` aluno sem cadastro PRO · `429` limite de taxa.
Corpo: `{ "erro": "codigo", "mensagem": "texto em pt-BR" }`.

## Em aberto (reunião de 13/10)
1. Front direto ou proxy no BFF.
2. Domínios de CORS (web e app).
3. Campo de mentoria no SGI: existe ou vira tabela nova no banco do Flix?
4. Paginação do mural: cursor ou página.
