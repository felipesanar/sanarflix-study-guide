# Cronograma de Simulados sem data — diagnóstico e plano

## O que eu verifiquei

Consultei o banco de produção e a função que alimenta o componente.

Os 6 simulados da FUNEPE (IES em foco no print) estão assim em `simulados_admin`:

| Simulado | status | modalidade | data_liberacao | data_realizacao | data_encerramento |
|---|---|---|---|---|---|
| FUNEPE - 14/04/2026 | encerrado | vazio | vazio | vazio | vazio |
| FUNEPE - 24/03/2026 | encerrado | vazio | vazio | vazio | vazio |
| FUNEPE - 26/05/2026 | encerrado | vazio | vazio | vazio | vazio |
| FUNEPE - 27/07/2026 | encerrado | vazio | vazio | vazio | vazio |
| FUNEPE - 28/04/2026 | encerrado | vazio | vazio | vazio | vazio |
| FUNEPE 09/06/2026 | encerrado | vazio | vazio | vazio | vazio |

Ou seja: **todas as colunas de data estão vazias**.

## Causa

Não é bug da função nem do componente.

- `get_gestor_cronograma` monta a data como "data de realização, ou na falta dela a data de liberação". Com as duas vazias, ela devolve data nula — e o componente, por regra do projeto (nunca inventar número), mostra o travessão e a legenda "Data de realização não registrada". Comportamento correto.
- A causa raiz é **falta de preenchimento no cadastro do simulado**. Esses simulados foram criados/importados sem modalidade e sem data; a data existe apenas no *nome* ("Simulado FUNEPE - 14/04/2026"), que é texto livre e não é lido como data por lugar nenhum.
- Não é um caso isolado da FUNEPE: **21 dos 39 simulados** do banco estão sem nenhuma das duas datas.

Também confirmei que não existe fonte alternativa confiável no banco: as datas de `simulados_finalizados`/`simulados_iniciados` desses simulados são de 28/04 e 06/08 (datas da importação das respostas), não das aplicações reais — usá-las como data de aplicação mostraria data errada.

## Plano de ação

### Ação sua (o que resolve de verdade, e já é possível hoje)
No Admin → Simulados, no diálogo de configuração de cada simulado, definir **modalidade** (presencial/online) e a **data de realização** (presencial) ou **data de liberação** (online). Assim que salvo, o cronograma passa a exibir "14 abr" na coluna da esquerda, a pílula de modalidade e o rótulo correto ("Realização"/"Início"). São 6 simulados na FUNEPE e 21 no total.

### Ação minha — opção A (recomendada): backfill assistido
Como o nome dos 21 simulados carrega a data (`- dd/mm/aaaa`), eu monto um script de conferência que extrai a data do nome e te devolve uma tabela "simulado → data proposta" para você aprovar. Só depois de aprovada, aplico uma migration aditiva que grava `data_realizacao` (e `modalidade = presencial`, se você confirmar) apenas nas linhas hoje nulas — sem sobrescrever nada já preenchido. Nomes fora do padrão ficam de fora e vão para você resolver manualmente.

### Ação minha — opção B: prevenção no cadastro
Tornar modalidade + data obrigatórias no diálogo de criação/edição de simulado no Admin, para que nenhum simulado novo entre sem data. Pode ser feita junto com a A ou depois.

### O que eu não recomendo
Derivar a data de aplicação das respostas dos alunos ou do texto do nome direto em tempo de exibição. Nos dois casos a tela passaria a afirmar uma data que o cadastro não confirma — e, nos dados atuais da FUNEPE, seria uma data errada.

## Detalhes técnicos
- Função: `public.get_gestor_cronograma(p_ies_id uuid)` — campo `data` = `COALESCE(sa.data_realizacao, sa.data_liberacao)`.
- Componente: `src/features/gestor/components/CronogramaSimulados.tsx` (`ColunaData`, aviso `semDataRegistrada`).
- Escrita admin: RPC `admin_update_simulado(p_data_realizacao, p_modalidade, ...)`, usada por `src/services/admin/simulados.ts`.
- Opção A é migration puramente aditiva (`UPDATE ... WHERE data_realizacao IS NULL AND data_liberacao IS NULL`), sem DELETE/TRUNCATE.
