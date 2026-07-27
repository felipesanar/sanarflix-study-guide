# 09 · Contratos de API

Fonte da verdade da UI: `contracts/types.ts` (tipos) + `contracts/openapi.yaml` (endpoints) + `contracts/fixtures/` (payloads de exemplo).

Convenções gerais:
- Autenticação por sessão/JWT; **o escopo de IES vem do token**, nunca do parâmetro.
- Todo recurso agregado devolve `meta` com rastreabilidade e flags.
- Datas ISO 8601 (`2026-05-10`); a UI formata em `dd/MM/yyyy`.
- Erros no formato RFC 7807 (`type`, `title`, `status`, `detail`, `traceId`).

## Endpoints

| Método | Rota | Devolve |
|---|---|---|
| `GET` | `/gestor/contexto` | Usuário, papel, IES acessíveis, contrato vigente |
| `GET` | `/gestor/cronograma` | Simulados contratados com status e datas |
| `GET` | `/gestor/avisos` | Avisos da Sanar (lido/não lido) |
| `PATCH` | `/gestor/avisos/{id}` | Marca como lido |
| `GET` | `/gestor/visao-geral` | KPIs + evolução + resumo do diagnóstico + distribuição de alunos |
| `GET` | `/gestor/diagnostico` | Um nível da cascata (`?node=`) |
| `GET` | `/gestor/diagnostico/temas` | Temas do drawer (`?especialidade=`) |
| `GET` | `/gestor/alunos` | Tabela de alunos (paginada) |
| `GET` | `/gestor/alunos/{id}` | Visão detalhada do aluno |
| `GET` | `/gestor/detalhamento` | Métricas, exploração e alunos por simulado(s) |
| `GET` | `/gestor/detalhamento/questoes` | Questões do simulado (paginada) |
| `POST` | `/gestor/exportacoes` | Solicita export de um recorte (assíncrono) |

## Parâmetros comuns

```
semestre = "6ano" | "geral" | "1".."12"
simulados = lista de ids (mínimo 1 no Detalhamento; "todos" é inválido → 400)
page, pageSize, sort, order, q (busca), area, especialidade
```

## Regras que o backend precisa impor (não só a UI)

1. `simulados` vazio ou `todos` → **400** com `title: "Seleção de simulados obrigatória"`.
2. Nunca devolver média única quando houver 2+ simulados: o payload traz **uma entrada por simulado**.
3. `variacao` só é preenchida quando o aluno participou de **todos** os simulados comparados; caso contrário `null`.
4. Conceito ENAMED nunca vem como média: com 2+ simulados, vem `porSimulado[]`.
5. Amostra `n < 10` → `lowSample: true` no nó/linha correspondente.
6. Gabarito não fechado → `status: "processing"` e **sem números**.
7. Aluno que não participou → `participou: false` e métricas `null` (nunca `0`).
8. Toda resposta agregada traz `meta.criterio` (texto exibido no tooltip) para não divergir entre telas.

## Envelope padrão

```jsonc
{
  "data": { /* recurso */ },
  "meta": {
    "periodo": "6º ano · 3 simulados",
    "fonte": "Simulados Academy · gabarito oficial",
    "atualizadoEm": "2026-05-12T09:30:00-03:00",
    "criterio": "Proficiente = proficiência acima de 60",
    "partial": false,
    "lowSample": false
  }
}
```

## Paginação

```jsonc
{ "data": [...], "page": 1, "pageSize": 25, "total": 104, "totalPages": 5 }
```

Tabelas acima de 100 linhas usam paginação servidor + virtualização no cliente.

## Export

`POST /gestor/exportacoes` → `202 Accepted` com `{ id, status: "queued" }`; a UI faz polling ou recebe por websocket. **Nunca exporta a base inteira** — o payload obriga um recorte (`escopo`, `filtros`) e o backend valida a permissão de export do papel.
