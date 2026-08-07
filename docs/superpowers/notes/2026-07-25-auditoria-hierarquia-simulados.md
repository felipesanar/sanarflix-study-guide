# Auditoria de dado — Fase 0 do Portal do Gestor v2

**Data de execução:** 2026-07-28
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

Recomendação para a Fase 2: usar `btrim(col, E' \t\n\r')` — não o `btrim(col)` de um argumento — em qualquer agregação por `grande_area`/`especialidade`/`tema` nas RPCs de diagnóstico, para que um whitespace novo cadastrado depois não abra nó duplicado na cascata.

#### 1.5.1 RESOLVIDO em 28/07/2026 — e o escopo real era maior

As duas questões acima foram normalizadas em produção (`update` de dado, não migration):

```sql
update public.questoes_simulado
set grande_area   = btrim(grande_area,   E' \t\n\r'),
    especialidade = btrim(especialidade, E' \t\n\r'),
    updated_at    = now()
where id in ('6dafd2de-3b92-4d24-955e-08b5da24b481',   -- 1º simulado - UNIVILLE, ordem 16
             'c768b768-ac56-42af-8654-1257172049a2');  -- 1º simulado UEA, ordem 16
```

Verificado depois: `grande_area` distintas caiu de 9 para **8**, zero linhas com whitespace em `grande_area`, e `Cirurgia` passou de 808 para 810 questões — absorveu as duas sem perder nenhuma.

**Porém**, ao medir o escopo antes de aplicar, o problema se mostrou bem maior que as 2 linhas relatadas acima. Contagem por coluna, antes da correção:

| Coluna | Linhas com whitespace | Valores distintos hoje | Após normalizar | Nós duplicados |
|---|---|---|---|---|
| `grande_area` | 2 | 9 | 8 | 1 ✅ corrigido |
| `especialidade` | **136** | 252 | 244 | **8** ⏳ aberto |
| `tema` | 6 | 731 | 730 | 1 ⏳ aberto |
| `competencia` | 13 | 138 | 137 | 1 ⏳ fora de escopo |

A seção 1.4 não pegou isso porque a AUDITORIA 3 do plano agrupa **só** `grande_area` — o vocabulário de `especialidade` e `tema` nunca foi auditado contra whitespace.

Por que importa para a Fase 2: `especialidade` é o **2º nível da cascata** do Diagnóstico Curricular. Com 8 nós duplicados, a gestora veria a mesma especialidade duas vezes dentro de uma grande área, com o % de acerto dividido entre as duas.

Verificação de segurança feita antes de qualquer `update`: `grande_area`, `especialidade` e `tema` têm **zero** valores compostos só de whitespace, então `btrim` nunca transforma um valor em string vazia (o que desclassificaria a questão). E todos os 8 valores sujos de `especialidade` duplicam um valor limpo que já existe — normalizar mescla, não cria valor novo nem perde informação.

`competencia` fica fora: tem 1.300 linhas que `btrim` transformaria em vazio (já são whitespace puro), e a coluna não faz parte da hierarquia de 3 níveis da §4.9.

Pendente de decisão: normalizar as 134 linhas restantes de `especialidade` e as 6 de `tema`. É a mesma operação, já validada nas 2 primeiras.

Consequência para a Fase 2: a cascata de `get_gestor_diagnostico` agrupa questões
sem `grande_area` sob o rótulo literal "Sem classificação" e **não** as descarta
(descartar mudaria o denominador do % de acerto silenciosamente).

Hoje esse nó nasce **vazio** em produção (0 questões sem `grande_area`), e isso é o resultado esperado — ele existe como salvaguarda para questão cadastrada sem classificação no futuro, não como caminho ativo.

## 2. Distribuição das réguas de desempenho (§4.4, pendência nº1)

**Data de execução:** 2026-07-28
**Executada por:** João Vitor (task atribuída ao Felipe no Notion; antecipada para não travar a Task 8, que consome esta decisão)

### 2.1 Query executada

```sql
-- Distribuição real de % de acerto por (IES, simulado, grande área)
-- Atenção: em answer_progress a coluna do simulado é `simulado`, não `simulado_id`.
with base as (
  select
    u.id_ies                                             as ies_id,
    ap.simulado                                          as simulado_id,
    coalesce(nullif(btrim(q.grande_area),''), 'Sem classificação') as grande_area,
    ap.correct
  from public.answer_progress ap
  join public.questoes_simulado q on q.id = ap.question_id
  join public.users u             on u.id = ap.user_id
  where q.anulada = false and u.id_ies is not null
),
recorte as (
  select ies_id, simulado_id, grande_area,
         count(*) as respostas,
         round(100.0 * count(*) filter (where correct) / nullif(count(*),0), 2) as acerto_pct
  from base group by 1,2,3
)
select i.nome as ies, s.nome as simulado, r.grande_area, r.respostas, r.acerto_pct,
  case when r.acerto_pct < 30 then 'critico' when r.acerto_pct >= 80 then 'excelente' else 'mediano' end as nivel_corte_30,
  case when r.acerto_pct < 50 then 'critico' when r.acerto_pct >= 80 then 'excelente' else 'mediano' end as nivel_corte_50
from recorte r
join public.ies i             on i.id = r.ies_id
join public.simulados_admin s on s.id = r.simulado_id
order by i.nome, s.nome, r.acerto_pct asc;
```

```sql
-- Contagem agregada: quantos recortes (IES × simulado) têm ao menos uma área crítica
with base as ( /* idem acima */ ),
recorte as ( /* idem acima */ ),
por_recorte as (
  select ies_id, simulado_id,
         count(*)                                 as areas,
         count(*) filter (where acerto_pct <  30) as areas_criticas_30,
         count(*) filter (where acerto_pct <  50) as areas_criticas_50,
         count(*) filter (where acerto_pct >= 80) as areas_excelentes
  from recorte group by 1,2
)
select
  count(*)                                      as recortes_total,
  count(*) filter (where areas_criticas_30 = 0) as recortes_sem_critico_corte30,
  round(100.0 * count(*) filter (where areas_criticas_30 = 0) / nullif(count(*),0), 1) as pct_sem_critico_corte30,
  count(*) filter (where areas_criticas_50 = 0) as recortes_sem_critico_corte50,
  round(100.0 * count(*) filter (where areas_criticas_50 = 0) / nullif(count(*),0), 1) as pct_sem_critico_corte50,
  count(*) filter (where areas_excelentes = 0)  as recortes_sem_excelente,
  round(avg(areas), 1)                          as media_areas_por_recorte
from por_recorte;
```

Os percentis usam a mesma CTE `recorte`, com `percentile_cont` sobre `acerto_pct`.

### 2.2 Resultado por recorte (IES × simulado × grande área)

São **320 linhas** no total. Abaixo as **20 menores** e as **10 maiores**, conforme o plano.

| ies | simulado | grande área | respostas | % acerto | nível (corte 30) | nível (corte 50) |
|---|---|---|---|---|---|---|
| B2B | 1º simulado UEA | Preventiva | 20 | 0.00 | critico | critico |
| B2B | 2º simulado FAI | Pediatria | 19 | 0.00 | critico | critico |
| B2B | 2º simulado FAI | Preventiva | 20 | 0.00 | critico | critico |
| B2B | 1º simulado UEA | Ginecologia e Obstetrícia | 18 | 0.00 | critico | critico |
| B2B | 1º simulado UEA | Clínica Médica | 25 | 0.00 | critico | critico |
| B2B | 1º simulado UEA | Pediatria | 18 | 0.00 | critico | critico |
| B2B | Teste FAI | Preventiva | 40 | 0.00 | critico | critico |
| B2B | Teste FAI | Cirurgia | 38 | 0.00 | critico | critico |
| B2B | 2º simulado FAI | Clínica Médica | 26 | 0.00 | critico | critico |
| B2B | 1º simulado UEA | Cirurgia | 18 | 0.00 | critico | critico |
| B2B | TESTE B2B | Pediatria | 38 | 0.00 | critico | critico |
| B2B | TESTE B2B | Cirurgia | 34 | 0.00 | critico | critico |
| B2B | 2º simulado FAI | Ginecologia e Obstetrícia | 18 | 0.00 | critico | critico |
| B2B | Teste FAI | Ginecologia e Obstetrícia | 36 | 0.00 | critico | critico |
| B2B | Teste FAI | Clínica Médica | 50 | 0.00 | critico | critico |
| B2B | TESTE B2B | Preventiva | 40 | 0.00 | critico | critico |
| B2B | 2º Simulado Claretiano | Ginecologia e Obstetrícia | 20 | 0.00 | critico | critico |
| B2B | TESTE B2B | Ginecologia e Obstetrícia | 36 | 0.00 | critico | critico |
| B2B | 1º simulado UEA | `Cirurgia\n` | 1 | 0.00 | critico | critico |
| B2B | 2º simulado FAI | Cirurgia | 17 | 0.00 | critico | critico |
| FAI | 3º Simulado FAI (2ª Repescagem) | Cirurgia | 19 | 94.74 | excelente | excelente |
| FAI | 3º Simulado FAI (2ª Repescagem) | Preventiva | 20 | 95.00 | excelente | excelente |
| FAI | 3º Simulado FAI (2ª Repescagem) | Clínica Médica | 25 | 96.00 | excelente | excelente |
| B2B | Teste Gabarito 2 | Ginecologia e Obstetrícia | 18 | 100.00 | excelente | excelente |
| B2B | Teste Gabarito 2 | Preventiva | 21 | 100.00 | excelente | excelente |
| B2B | Teste Gabarito 2 | Saúde Mental | 6 | 100.00 | excelente | excelente |
| B2B | Teste Gabarito 2 | Cirurgia | 18 | 100.00 | excelente | excelente |
| B2B | Teste Gabarito 2 | Pediatria | 16 | 100.00 | excelente | excelente |
| FAI | 3º Simulado FAI (2ª Repescagem) | Pediatria | 18 | 100.00 | excelente | excelente |
| B2B | Teste Gabarito 2 | Clínica Médica | 21 | 100.00 | excelente | excelente |

Por linha de área (as 320, não por recorte): 34 críticas no corte 30, 100 críticas no corte 50, 14 excelentes.

Nota: a linha `Cirurgia\n` com 1 resposta é o mesmo achado de normalização de whitespace registrado na seção 1.5. Ela aparece aqui como uma **grande área separada**, o que é a materialização do problema previsto: na cascata, viraria um segundo nó "Cirurgia".

### 2.3 Agregado

- Recortes (IES × simulado) analisados: **58**
- Recortes SEM nenhuma área crítica no corte <30: **51 (87,9%)**
- Recortes SEM nenhuma área crítica no corte <50: **21 (36,2%)**
- Recortes SEM nenhuma área excelente: **53**
- Média de grandes áreas por recorte: **5,5**
- Percentis do % de acerto por área: min **0,0** · p05 **0,0** · p25 **45,8** · mediana **56,3** · p75 **65,0** · max **100,0**

### 2.4 DECISÃO

**NIVEL_CRITICO_MAX = 30**

Determinação de produto, 28/07: o corte é **30**, conforme a régua canônica da spec §4.4. O texto da Task 2 que abria a possibilidade de subir para 50 estava errado, e o critério de decisão que ele descrevia não vale.

**O que a medição mostrou, e que segue valendo como fato:** `pct_sem_critico_corte30 = 87,9%` — em 51 dos 58 recortes o corte de 30 não classifica **nenhuma** grande área como crítica. Descontado o dado de teste, o número vai a **100%** em 47 recortes reais. A mediana de acerto por área é 56,3% e o p25 é 45,8%, então a massa vive bem acima de 30.

**Consequência aceita:** o grupo "crítico" do Diagnóstico Curricular nasce quase sempre vazio. Isso é conhecido, não é bug, e não deve ser tratado como defeito de implementação quando a tela da Fase 4 aparecer sem áreas críticas. O corte é 30 porque é o corte da régua canônica do projeto — não porque a distribuição o recomende.

Se em algum momento se decidir revisitar, o número medido acima é o insumo, e o custo é uma constante mais dois casos de fronteira no teste. Este valor é consumido literalmente por `src/features/gestor/lib/regras.ts` (constante `NIVEL_CRITICO_MAX`); não há impacto de arquitetura.

### 2.5 Verificação de robustez (não altera o critério)

O critério foi aplicado sobre o dado bruto, como fixado. Mas os 20 recortes de menor acerto são **todos 0,00% e todos da IES `B2B`**, em simulados chamados `TESTE B2B`, `Teste FAI`, `Teste Gabarito 2` — dado de teste, não uso real. Como esse dado é justamente o que **produz** área crítica no corte de 30, ele empurra o resultado na direção conservadora (contra subir o corte). Refiz o agregado excluindo a IES `B2B` e todo simulado com "teste" no nome:

| Recorte | Bruto (fixado) | Sem dado de teste |
|---|---|---|
| Recortes analisados | 58 | 47 |
| Sem área crítica no corte <30 | 51 (**87,9%**) | 47 (**100,0%**) |
| Sem área crítica no corte <50 | 21 (36,2%) | 20 (42,6%) |
| Sem área excelente | 53 | 44 |

Sem o dado de teste, **nenhum** recorte real teria área crítica no corte de 30. A decisão por 50 é robusta: a exclusão do dado de teste a reforça em vez de contradizê-la. Não houve ambiguidade de fronteira — 87,9% e 100% estão ambos longe dos 70%.

### 2.6 Achado informativo (não muda corte nesta fase)

`recortes_sem_excelente = 53` de 58 (**91,4%**), e 44 de 47 excluindo dado de teste. O topo da régua praticamente não é exercitado: só 14 das 320 linhas de área chegam a 80%+, e as que chegam concentram-se em `Teste Gabarito 2` (gabarito de teste, 100% em tudo) e no `3º Simulado FAI (2ª Repescagem)`. A mediana de 56,3% e o p75 de 65,0% confirmam que a massa vive na faixa mediana.

Isso é consistente com a decisão de subir o corte inferior e **não** é motivo para baixar o corte de excelente nesta fase — a §4.4 fixa `>=80` a partir da régua canônica, e mexer nisso seria redesenhar a régua, fora do escopo desta task. Vale reavaliar no fim do piloto, com dado de uso real e volume maior.
