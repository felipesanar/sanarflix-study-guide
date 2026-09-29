# ENAMED 2026 · Prova oficial no Academy (UniAtenas)

**Data:** 29/09/2026 · **Autor:** Felipe Souza · **Status:** design aprovado em conversa (28–29/09), spec em revisão

## 1. Contexto

A prova oficial do ENAMED 2026 (INEP) foi aplicada em 13/09/2026. A UniAtenas enviou os cartões-resposta de 4 campi em 8 planilhas: Paracatu, Passos, Sete Lagoas e Valença, cada campus com "Prova Tipo 01" e "Prova Tipo 02".

O objetivo tem três partes:
1. Subir essas respostas no Academy, com a prova cadastrada como um simulado.
2. Fazer o resultado refletir corretamente no portal do gestor.
3. Dar à prova uma experiência "especial" para o aluno e para o gestor.

### Fatos verificados

- **Volume:** 328 linhas e 326 alunos distintos. 2 alunos de Passos aparecem duplicados, com cartões diferentes.
- **Tipo = caderno:** Tipo 01 = Caderno 1 e Tipo 02 = Caderno 2. Os dois gabaritos das planilhas batem 100/100 com o gabarito **preliminar do INEP**, tanto no PDF quanto em `edicao_fases` do projeto Ranking Enamed.
- **Mapa entre cadernos:** está em `questoes.mapa_posicao` (Ranking Enamed) e confere com o CSV de digitação e com os dois gabaritos.
- **Totais batem:** os acertos recalculados das 328 linhas batem com a aba "Acerto por Aluno" das planilhas.
- **Marcações duplas:** há 4 em Paracatu Tipo 02 e contam como erro. A regra é a mesma do importador do admin: grava a letra que não é o gabarito.
- **Contas:** 100% dos alunos têm conta, no campus certo, e cada campus é uma IES própria. 318 casam por `users.matricula_ra` exato. Os 8 restantes casam só pelo nome completo:
  - 4 com RA gravado sem um hífen;
  - 2 com RA diferente da planilha;
  - 1 sem RA no cadastro;
  - 1 sem RA na planilha.
- **Portal do gestor:** os 4 campi estão no portal v2 (`gestao.portal_v2 = true`).
- **Questões e imagens:** as 100 questões, com comentário do professor, estão no Ranking Enamed (`public.questoes`). 16 questões têm imagem, e os arquivos de imagem ainda não estão disponíveis.
- **TRI:** a proficiência e o conceito do gestor dependem de `resultados_alunos_tri` / `resultados_ies_tri`, escritas só pelo motor TRI externo (João Nader). O último lote do Ranking é da fase "sanar" (14/09, itens 70 e 72 excluídos). Não existe lote no gabarito preliminar.

## 2. Decisões

| # | Decisão |
|---|---|
| D1 | Correção pelo **gabarito preliminar do INEP**. Recalcular quando sair o definitivo. |
| D2 | A experiência especial vale para **aluno e gestor**. |
| D3 | **O aluno não vê nota TRI** (nem proficiência ou nota estimada). Vê acertos, desempenho por área e questão a questão. A TRI fica só no gestor. |
| D4 | A revisão questão a questão segue a **ordem e numeração do caderno que o aluno fez**. |
| D5 | No gestor, a prova ganha um **bloco próprio** na Visão Geral e um ponto destacado na evolução, e fica **fora da contagem do contrato**. Detalhamento, Alunos e Questões funcionam como simulado, com selo. |
| D6 | **Abordagem A:** a prova continua `type = 'simulado_enamed'` e ganha a flag `prova_oficial`. O tipo não muda porque o filtro `type = 'simulado_enamed'` está fixo em ~15 RPCs do gestor. |
| D7 | Grandes áreas **como estão na prova**: as 5 da UniAtenas (Clínica Médica, Cirurgia, Pediatria, Ginecologia e Obstetrícia, Medicina de Família e Comunidade) **+ Saúde Coletiva e Saúde Mental**. O detalhe Ginecologia × Obstetrícia fica em `especialidade`. |
| D8 | Os 2 alunos duplicados ficam **fora** da carga até a UniAtenas confirmar qual cartão vale. **Carga = 324 alunos.** |
| D9 | Cadastro de usuários intocado, **exceto** preencher o RA da aluna que está sem matrícula (valor da planilha). O semestre dela (= 2) só muda após confirmação. |
| D10 | A calibração TRI é feita pelo João. Proposta: calibrar com a base do Ranking no gabarito preliminar e aplicar a escala aos alunos da UniAtenas, gerando as linhas por campus. |

## 3. Modelo de dados (migration aditiva)

- `simulados_admin.prova_oficial boolean NOT NULL DEFAULT false`.
- `simulado_cadernos (simulado_id, caderno, posicao, question_id)`: PK `(simulado_id, caderno, posicao)`, UNIQUE `(simulado_id, caderno, question_id)`. 200 linhas para esta prova.
- `simulado_aluno_caderno (simulado_id, user_id, caderno, created_at)`: PK `(simulado_id, user_id)`. 324 linhas.
- RLS: admin gerencia; `simulado_cadernos` legível por `authenticated`; `simulado_aluno_caderno` legível pelo próprio aluno. O gestor lê via RPC `SECURITY DEFINER`.

As questões ficam na numeração do **Caderno 1**: `numero_questao = ordem = posição no Caderno 1`. As respostas do Caderno 2 são convertidas para essa numeração antes da carga.

## 4. Carga (resultado escondido até a liberação)

1. **RA:** preencher o RA da aluna sem matrícula (`00_arithana_ra.sql`, com guardas).
2. **Simulado:** "ENAMED 2026 · Prova oficial (13/09/26)" nos 4 campi, com:
   - `type 'simulado_enamed'`, `prova_oficial true`, presencial, `status 'encerrado'`, realização em 13/09/2026;
   - `liberacao_desempenho 'agendado'` em 31/12/2099 (resultado escondido; o gestor foi liberado em 29/09, ver §7);
   - **sem** vínculo em `ies_simulado_previsto`.
3. **Questões:** 100, a partir do Ranking, com `correta` = gabarito preliminar do Caderno 1. As áreas seguem a D7; o gatilho `normalize_grande_area` mantém os 7 nomes.
4. **Mapa de cadernos:** 200 linhas.
5. **Respostas:** via `admin_import_responses_batch`, a mesma RPC do importador do admin, com `request.jwt.claims.role = service_role`.
   - Fica registrado um lote em `admin_import_batches`, com `created_by` = Felipe e `conflict_mode 'skip'`.
   - Cada parte aborta inteira se algum aluno não resolver para exatamente 1 usuário.
   - `finalizado_em` = 13/09/2026 e tempo = 300 min.
   - Há uma planilha fallback (RA + 100 colunas no Caderno 1) para o importador do admin.
6. **Caderno de cada aluno:** 324 linhas.
7. **Conferência:**
   - contagem por campus;
   - 32.400 respostas;
   - brancos esperados;
   - acertos por aluno = planilha (**0 divergências**);
   - cadernos por tipo;
   - registros do lote por status.
8. **TRI:** o João gera as notas; conferir 324 linhas de aluno + 4 de campus.

## 5. Experiência do aluno

- **Entrada:** card destacado no topo de `/simulados`, **"ENAMED 2026 · Sua prova oficial"**, com os acertos e o botão "Ver meu resultado". Aparece só para quem tem respostas nessa prova. Nas listas de desempenho existentes, a prova aparece com selo, leva à tela própria e não entra em ranking.
- **Tela própria** (rota dedicada, mobile-first):
  1. **Cabeçalho:** prova, data, caderno e "Você acertou X de 100". Branco conta como erro; questões anuladas saem da conta.
  2. **Por área:** as 7 grandes áreas (acertos/total), com destaque para a melhor e a mais fraca.
  3. **Trajetória:** % de acerto nos simulados que o aluno fez na plataforma, seguido da prova oficial. Um aviso diz que são provas diferentes e que o que se lê é a tendência.
  4. **Questão a questão**, na ordem do caderno do aluno. Filtros: todas, erradas, em branco e por área. Cada questão mostra enunciado, alternativas, a resposta do aluno, o gabarito preliminar do INEP, o comentário do professor e, em texto menor, "no Caderno 1 era a questão N".
  5. **Aviso fixo:** correção pelo gabarito preliminar; se o definitivo mudar, a tela é atualizada.
- **Fora de propósito:** nota TRI, proficiência, comparação com colegas e a marcação de "possível recurso".
- Todas as telas de aluno que hoje exibem TRI de um simulado devem **ocultá-la** quando `prova_oficial = true`.

## 6. Experiência do gestor (portal v2)

- **Bloco na Visão Geral:** "★ ENAMED 2026 · Prova oficial · 13/09", com participantes, conceito estimado, % de proficientes e média de acertos. Traz um aviso de estimativa Sanar (TRI, gabarito preliminar; o conceito oficial é do INEP) e o botão "Ver detalhamento". O bloco respeita o filtro de semestre, com o estado "sem participantes neste recorte" e o aviso de amostra pequena (< 10).
- **Indicadores principais inalterados:** o "atual" e a série de evolução continuam vindo do último simulado. A prova aparece como um ★ separado na evolução.
- **Contrato:** a prova não conta no "x de y", porque não é vinculada a `ies_simulado_previsto`.
- **Demais telas:** Detalhamento, Alunos, Questões e a ficha do aluno funcionam como simulado, com o selo "★ Prova oficial". Em Questões, a numeração é do Caderno 1, com a do Caderno 2 menor. O diagnóstico curricular inclui a prova.
- **Banco:**
  1. `get_gestor_visao_geral` ganha um único filtro que exclui `prova_oficial` da série e do "atual". A alteração **parte da definição viva em prod** (armadilha do guard de feature), com a definição anterior salva para rollback.
  2. Nova `get_gestor_prova_oficial(p_ies_id, p_semestre)`: devolve o bloco e os ids das provas oficiais da IES, para o selo no front. Usa a mesma checagem de acesso (`gestor_pode_acessar_ies`) e o mesmo guard de feature das vizinhas.
  3. As outras RPCs do gestor ficam intactas.

## 7. Operação

1. **Código:** branch `feat/enamed-prova-oficial` → PR → revisão. **A publicação é feita pelo Felipe.**
2. **Migration em prod:** só com ok explícito, no momento da aplicação.
3. **Carga:** a seção 4 roda com o resultado escondido e pode ir antes do front.
4. **Liberação em duas travas independentes** (substitui a liberação única; decisão de 29/09):
   - **Gestor:** `liberacao_desempenho = 'imediato'`. **Feito em 29/09 às 11:54**, a pedido do Felipe, antes do TRI. Proficiência e conceito ficam "aguardando" até o lote do João.
   - **Aluno:** `prova_oficial_liberada_aluno = true`, só com o ok do Leo, passado pelo Felipe. Exige também a trava do gestor aberta, porque as RPCs do aluno aplicam as duas condições.
   - Antes da liberação do aluno: 16 imagens carregadas e duplicados resolvidos ou fora de propósito.
   - O job `notify-performance-released` ignora `'imediato'` e só notifica quem tem `simulados_finalizados`; a prova não tem nenhum. Não há push automático para os alunos.
5. **Gabarito definitivo:** atualizar `correta` / `anulada` das questões, recalcular `answer_progress.correct` do simulado e pedir ao João um novo lote TRI. Procedimento manual, executado uma vez.

## 8. Testes e verificação

- **Dados:** as consultas da seção 4.7, mais a conferência questão a questão de 3 alunos do Caderno 2 contra a linha original da planilha.
- **Regressão do gestor:** saída de `get_gestor_visao_geral` antes e depois para **todas** as IES do portal v2. Tem que ser idêntica onde não há prova oficial.
- **Nova RPC:** executada como um gestor real da UniAtenas, dentro de transação com ROLLBACK.
- **Front:** testes unitários da ordem por caderno, dos acertos por área e da visibilidade do card, além de verificação no preview local com print. Para entrar como aluno é preciso uma conta de teste.

## 9. Rollback

- **Esconder do aluno:** `prova_oficial_liberada_aluno = false`.
- **Esconder do gestor:** `liberacao_desempenho = 'agendado'` com `data_liberacao_desempenho` no futuro.
- **NUNCA usar `prova_oficial = false` como rollback.** Todas as exclusões dependem dessa flag. Desligá-la faz a prova virar um simulado comum em todas as listas, agregados, rankings e na RLS do TRI do aluno, que é o contrário de esconder.
- **Remover os dados:** DELETE por `simulado_id`. As tabelas novas têm `ON DELETE CASCADE`.
- **Reverter funções alteradas:** as definições anteriores estão em `public.function_def_backups` (coluna `def`; reexecutar com `EXECUTE`).
- **Migrations de reescrita:** `…_exclusoes`, `…_trava_aluno`, `…_agregados_trava_aluno` e `…_drilldown_trava_aluno` dependem do corpo vivo em prod (âncoras exatas). Não são reexecutáveis num banco novo.

## 10. Pendências externas

| Item | Com quem |
|---|---|
| Qual cartão vale para os 2 alunos duplicados de Passos | UniAtenas |
| PDF oficial do caderno, para recortar as 16 imagens | Felipe / INEP |
| Semestre = 2 da aluna de Valença (deveria ser 12?) | UniAtenas / CX |
| Lote TRI no gabarito preliminar + linhas por campus | João Nader |
| Porto Seguro e Sorriso não vieram nas planilhas: confirmar se não houve participantes | UniAtenas |
