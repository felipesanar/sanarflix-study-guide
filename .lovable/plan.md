# Liberar resultados de simulados sem nota TRI no Portal do Gestor

## O que muda para o gestor
- Um simulado encerrado que **tem respostas de alunos** passa a aparecer como "Resultados" no cronograma, mesmo sem nota TRI. Hoje ele fica preso em "Gabarito em processamento" (ex.: FUNEPE 24/03 e 05/09 no print).
- Esse simulado pode ser escolhido no Detalhamento e entra na Visão geral.
- Os números de acerto (percentual de acerto, acerto por área, especialidade, tema, questões, alunos) aparecem normalmente.
- Os números que dependem da TRI (nota TRI, conceito ENAMED, alunos proficientes, proficiência) continuam mostrando "—" nesse simulado. Nada é inventado.
- "Gabarito em processamento" fica só para simulado encerrado **sem nenhuma resposta**.

## Visão geral
- Hoje ela só considera simulados com TRI. Passa a considerar também os que só têm respostas.
- Percentual de acerto e evolução por área usam todos esses simulados.
- Conceito ENAMED e Alunos proficientes continuam vindo do simulado mais recente **com TRI**, para não aparecer "—" à toa na coluna Atual.
- O gráfico de evolução da TRI segue mostrando só os pontos com TRI. A legenda que já existe avisa quantos ficaram de fora.

## Fora do escopo
- Não calcula TRI. Não muda o contrato ("simulados realizados" continua contando só os que têm TRI). Não muda a experiência do aluno.

## Detalhes técnicos
- Migração aditiva via `CREATE OR REPLACE` (com corpo extraído por `pg_get_functiondef`, preservando guards, `SECURITY DEFINER` e o filtro `type='simulado_enamed'`):
  - `get_gestor_cronograma`: `realizado` = encerrado E (tem `resultados_ies_tri` OU tem `answer_progress` de aluno da IES); `processing` = encerrado sem nenhum dos dois. Atualizar o texto de `criterio`.
  - `get_gestor_visao_geral`: CTE `realizados` volta a `n_resp > 0 OR n_tri > 0`; os KPIs de Conceito/Proficientes escolhem o ponto Atual/Anterior/Primeiro entre os simulados com `n_tri > 0`; acerto usa a lista completa.
  - `get_gestor_detalhamento` (e as RPCs irmãs que tiverem o mesmo filtro `n_tri > 0`: questões, diagnóstico, alunos): remover o filtro de TRI na escolha de simulados, mantendo `NULL` nos campos TRI.
- Front: só ajustar se algum componente (ex.: seletor do Detalhamento, `KpisDetalhamento`) bloquear simulado sem TRI; nesse caso, mostrar "—" nos campos TRI.
- Verificação: rodar as RPCs para a FUNEPE e conferir que 24/03 e 05/09 viram "realizado" com acerto preenchido e TRI nulo; abrir o Detalhamento desse simulado no navegador.
