# Desempenho da aluna Thawany (UNIATENAS Porto Seguro)

## O que já foi conferido no banco
- Conta: THAWANY SILVA ALMEIDA, 9º semestre, IES Porto Seguro, sem papéis especiais.
- Tem 100 respostas em cada um de 8 simulados (todos ENAMED, liberação de desempenho "imediato", não são prova oficial). Todas as respostas casam com as questões do próprio simulado.
- A IES tem a funcionalidade "Desempenho de simulados" ativa.
- Pelas regras atuais das consultas da tela, os 8 simulados deveriam aparecer para ela. Ou seja, os dados estão corretos e a causa provável está em como a tela carrega, não nos dados.
- Não consegui entrar como ela daqui (só admins do workspace podem gerar sessão de outro usuário), então a causa ainda não está confirmada.

## Ponto frágil encontrado na tela
A tela de Desempenho faz 4 consultas ao mesmo tempo (lista de simulados, totais, ranking, semestre). Se qualquer uma falhar ou demorar demais, a tela inteira cai no aviso "Nenhum dado de simulado", mesmo havendo respostas. A consulta de ranking da "Visão Geral" percorre todas as respostas da plataforma (~1,4 milhão de linhas, 1,3 s hoje) e já estourou o tempo limite antes. Além disso, um resultado vazio fica guardado no navegador por um tempo.

## Plano
1. Confirmar a causa: abrir a tela como a aluna pelo modo Suporte (impersonação de admin) e registrar qual consulta falha. Se você puder, me diga o que ela vê (tela vazia, carregando infinito ou erro).
2. Tornar a tela resistente: se ranking ou semestre falharem, mostrar os resultados mesmo assim (ranking aparece como "—"). Só mostrar "Nenhum dado" quando de fato não houver respostas; se a falha for na lista/totais, mostrar "Não foi possível carregar, tentar novamente" em vez de "Nenhum dado".
3. Não guardar no navegador resultados vazios ou com erro.
4. Acelerar o ranking da Visão Geral para não depender de varrer a base inteira (limitar o cálculo aos alunos da IES da aluna).
5. Se a reprodução mostrar outra causa, corrigir essa causa no lugar destes passos.

## Observação separada
Em 07/11 ela abriu um feedback dizendo que o "Simulado UNIATENAS - 13/10/26" aparece para ela mas não houve prova em Porto Seguro nesse dia. Esse simulado foi importado para 536 alunos (todos com 7200 s exatos) e a nota dela nele é 25/100, o que puxa o ranking dela para baixo. Vale confirmar com a IES se a importação incluiu Porto Seguro por engano. Não altero nada nisso sem sua aprovação.

## Detalhes técnicos
- `src/pages/SimuladoDesempenho.tsx`: trocar `Promise.all` por `Promise.allSettled` em `fetchDataForView`; só lançar erro em `get_user_simulados`/`get_user_performance_aggregates`; novo estado `loadError` com botão de tentar de novo; não gravar sessionStorage quando houver erro.
- Migration aditiva: `get_user_rankings` filtra `answer_progress` pelos usuários da IES do aluno (join com `users` antes de agregar), mesma assinatura e retorno.
- Teste unitário: tela mostra resultados quando ranking falha; mostra erro (não "Nenhum dado") quando os totais falham.
