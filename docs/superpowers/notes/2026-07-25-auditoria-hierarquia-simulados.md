# Auditoria de dado — Fase 0 do Portal do Gestor v2

**Data de execução:** 2026-07-27
**Projeto:** gvqv (gvqvrmkizemwsasmupmo) — confirmado via get_project_url (`https://gvqvrmkizemwsasmupmo.supabase.co`)
**Spec:** docs/superpowers/specs/2026-07-25-portal-gestor-v2-design.md
**Pendências atacadas:** nº3 (hierarquia, §4.9/§7.6) e nº1 (distribuição das réguas, §4.4)

## 1. Hierarquia de conteúdo (§4.9, §7.6)

### 1.1 Query executada

```sql
-- AUDITORIA 1: completude da hierarquia por simulado
with q as (
  select
    q.simulado_id,
    nullif(btrim(q.grande_area), '')   as grande_area,
    nullif(btrim(q.especialidade), '') as especialidade,
    nullif(btrim(q.tema), '')          as tema,
    q.anulada
  from public.questoes_simulado q
)
select
  s.id                                                     as simulado_id,
  s.nome                                                   as simulado,
  s.status,
  s.data_liberacao,
  cardinality(s.ies_ids)                                   as qtd_ies,
  count(*)                                                 as questoes,
  count(*) filter (where q.grande_area   is null)           as sem_grande_area,
  count(*) filter (where q.especialidade is null)           as sem_especialidade,
  count(*) filter (where q.tema          is null)           as sem_tema,
  count(*) filter (
    where q.grande_area is null or q.especialidade is null or q.tema is null
  )                                                        as questoes_incompletas,
  round(
    100.0 * count(*) filter (
      where q.grande_area is null or q.especialidade is null or q.tema is null
    ) / nullif(count(*), 0)
  , 2)                                                     as pct_incompletas,
  -- nó órfão de verdade: filho preenchido com pai vazio
  count(*) filter (where q.grande_area is null and q.especialidade is not null) as orfao_esp_sem_area,
  count(*) filter (where q.especialidade is null and q.tema is not null)        as orfao_tema_sem_esp,
  count(*) filter (where q.anulada)                        as anuladas
from public.simulados_admin s
join q on q.simulado_id = s.id
group by s.id, s.nome, s.status, s.data_liberacao, s.ies_ids
order by pct_incompletas desc, questoes desc;
```

### 1.2 Resultado por simulado

43 linhas (um simulado de `simulados_admin` não tem questões cadastradas — ver 1.3). Ordem da query: `pct_incompletas desc, questoes desc`.

| simulado | status | questões | sem grande_area | sem especialidade | sem tema | % incompletas | órfão esp/sem área | órfão tema/sem esp |
|---|---|---|---|---|---|---|---|---|
| TESTE_Simulado Diagnóstico | ativo | 143 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| TESTE_Simulado 2024.2 | ativo | 138 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| TESTE_Simulado 2024.1 | ativo | 121 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado Teste | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Teste Gabarito Simulado | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 3º Simulado FAI (Repescagem) | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 3 2026 - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado FUNEPE - 28/04/2026 | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado FUNEPE - 24/03/2026 | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 1º simulado UEA | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado ENAMED 1 - FAI | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 2 2026 - UNIATENAS (4° ano) | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 4 ano SORRISO - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 2º Simulado Claretiano | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado Global VALENÇA - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 1° Simulado Claretiano 2026 | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado Global SETE LAGOAS - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 4 ano SETE LAGOAS - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| TESTE GABARITO | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 3º Simulado FAI (2ª Repescagem) | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 3º Simulado - USCS | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| [CLARETIANO] 1_Simulado_2026 (4) | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado Global PARACATU - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 1º simulado - UNIVILLE | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 4 ano PORTO SEGURO - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 3º Simulado FAI | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado Global PASSOS - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| TESTE USCS 3 | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 4 ano PARACATU - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado FUNEPE - 26/05/2026 | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado FUNEPE 09/06/2026 | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 4º Simulado FAI | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| TESTE B2B | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 2º Simulado - USCS | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado FUNEPE - 14/04/2026 | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Teste FAI | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 2 2026 - UNIATENAS (5º e 6º ano) | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 1º Simulado - USCS | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado Global SORRISO - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Teste Gabarito 2 | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 3 ENAMED | aguardando | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| Simulado 4 ano VALENÇA - UNIATENAS | encerrado | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |
| 2º simulado FAI | ativo | 100 | 0 | 0 | 0 | 0.00 | 0 | 0 |

Questões anuladas (coluna `anuladas` da query, fora da tabela acima por não ser critério de hierarquia): `Simulado FUNEPE - 24/03/2026` = 7; `1° Simulado Claretiano 2026` = 1; `TESTE B2B` = 1; todos os demais = 0. Nenhuma questão anulada está incompleta, então a decisão não muda com ou sem elas no denominador.

### 1.3 Totais globais

- Questões: 4402
- Simulados com questões: 43
- % incompletas global: 0.00%

Sem `grande_area`: 0 · sem `especialidade`: 0 · sem `tema`: 0. A hierarquia de 3 níveis está **integralmente preenchida** em produção.

Observação: `simulados_admin` tem 44 linhas, mas só 43 aparecem na AUDITORIA 1 porque o `join` exclui simulado sem questões. O simulado sem nenhuma questão cadastrada é `23d6a38d-9690-482a-bb00-901a457ead0f` — `Simulado Global PORTO SEGURO - UNIATENAS` (`encerrado`). Não é achado de hierarquia (não há questão para classificar), mas vale saber que ele existe: na Fase 2 ele cai no estado vazio da cascata, não num nó órfão.

### 1.4 Vocabulário de grande_area

| grande_area | questões | simulados | especialidades distintas |
|---|---|---|---|
| Clínica Médica | 991 | 43 | 61 |
| Ginecologia e Obstetrícia | 859 | 43 | 32 |
| Cirurgia | 808 | 43 | 58 |
| Pediatria | 797 | 43 | 58 |
| Preventiva | 687 | 37 | 41 |
| Medicina de Família e Comunidade | 156 | 10 | 18 |
| Saúde Mental | 67 | 10 | 9 |
| Saúde Coletiva | 35 | 3 | 2 |
| `Cirurgia\n` (com newline no fim) | 2 | 2 | 1 |

Oito grandes áreas legítimas, sem duplicata semântica entre elas. A nona linha é uma duplicata de grafia real — ver 1.5.

### 1.5 DECISÃO

**HIERARQUIA_OK**

Critério aplicado: >5% de questões com qualquer nível nulo/vazio em um simulado ⇒
aquele simulado precisa de correção de dado antes do piloto; caso contrário
"Sem classificação" é nó legítimo na cascata.

Os três testes do critério passaram em **todos** os 43 simulados: `pct_incompletas` = 0.00 (limite: ≤ 5), `orfao_esp_sem_area` = 0, `orfao_tema_sem_esp` = 0. Nenhuma correção de dado é pré-condição do piloto.

Simulados que precisam de correção: nenhum

Achados de normalização (não bloqueantes): **1 achado** — duplicata de grafia por whitespace invisível. A mesma questão (`ordem` 16) em dois simulados tem `grande_area` = `"Cirurgia\n"` e `especialidade` = `"Trauma\n"`, com newline no fim:

| simulado_id | simulado | questões afetadas | ordem |
|---|---|---|---|
| `b7b19fb8-321c-44d4-9f4c-8ace50778d86` | 1º simulado UEA | 1 | 16 |
| `d540ac87-63a5-4835-8aa5-c02350b6ef00` | 1º simulado - UNIVILLE | 1 | 16 |

Por que passou pela AUDITORIA 1: `btrim(col)` sem segundo argumento remove **só espaços**, não `\n`/`\t`/`\r`. Então `"Cirurgia\n"` não é nulo nem vazio — a questão conta como completa (corretamente, ela **está** classificada), mas na cascata do Diagnóstico ela viraria um **segundo nó "Cirurgia"** separado do nó com 808 questões, e o mesmo para "Trauma" dentro dele. Impacto: 2 questões de 4402 (0.05%), ambas em simulados com 1 e 2 IES.

Encaminhamento: pedir ao CX a normalização de whitespace nessas duas questões (é `update` de dado, não migration). Não bloqueia o piloto, conforme a linha "duplicata de grafia" do critério. Recomendação adicional para a Fase 2: usar `btrim(col, E' \t\n\r')` — não o `btrim(col)` de um argumento — em qualquer agregação por `grande_area`/`especialidade`/`tema` nas RPCs de diagnóstico, para que um whitespace novo cadastrado depois não abra nó duplicado na cascata.

Consequência para a Fase 2: a cascata de `get_gestor_diagnostico` agrupa questões
sem `grande_area` sob o rótulo literal "Sem classificação" e **não** as descarta
(descartar mudaria o denominador do % de acerto silenciosamente).

Hoje esse nó nasce **vazio** em produção (0 questões sem `grande_area`), e isso é o resultado esperado — ele existe como salvaguarda para questão cadastrada sem classificação no futuro, não como caminho ativo.
