# Capturas

Capturas dos protótipos renderizados a 1380px de largura de layout (exportadas a 909px; leia como desktop) e a 390px (mobile). Os dados são de demonstração.

**Atualizadas em 04/11** (refletem os ajustes das reuniões de 13/10 e 22/10).

**Fidelidade:** as capturas mostram composição, hierarquia, cores, estados e textos. Para medidas finas de componentes que já existem no Portal do Gestor (KpiCard, Tag, tabelas, drawers), vale o componente do Gestor, conforme `docs/04-reuso-gestor.md`. Exemplo: o valor do KpiCard no Gestor tem 44px, e nas capturas aparece com 34px.

## B2C (`b2c/`)

| Arquivo | Tela / estado | Doc |
|---|---|---|
| 01-inicio | Início completo: faixa da tribo, visão geral, Quem precisa de você, Próximas sessões, A fazer | 02 § Tela 1 |
| 02-minha-turma | Minha Turma completa: indicadores com régua, matriz de prevalência, temas críticos (5), alunos | 02 § Tela 2 |
| 03-minha-turma-filtro-sumiram | Chegada pelo alerta "Sumiram": chip removível + lista filtrada | 02 § Tela 2 |
| 04-drawer-aluno | Drawer do aluno: cabeçalho sem semestre, agenda liberada, consumo no Flix, notas clicáveis | 02 § Drawer |
| 04b-drawer-aluno-consumo-notas | Drawer: bloco "Consumo no Flix" e notas por simulado | 02 § Ajustes 29/10 |
| 05-drawer-aluno-liberar-agenda | Switch ligado: "Falta 1 passo", mensagem obrigatória | 02 § Drawer |
| 06-drawer-aluno-agenda-erro-validacao | Erro "Sem mensagem, a agenda não é liberada." | 02 § Drawer |
| 08-detalhamento | Detalhamento completo com 4º + 5º, Q12 aberta, "Quem marcou C" | 02 § Tela 3 |
| 09-detalhamento-seletor-aberto | SeletorSimulados aberto (disponíveis / sem resultado) | 02 § Tela 3 |
| 10-detalhamento-drawer-grande-area | Drawer de grande área (Preventiva) com especialidades e temas | 02 § Tela 3 |
| 11-mural | Composer, prévia "Como o aluno vê", Publicadas com Editar/Excluir e Canais da tribo | 02 § Tela 4 |
| 11b-mural-editando-publicacao | Publicação carregada no composer para edição | 02 § Ajustes 29/10 |
| 12-mural-erros-validacao | Publicar sem título/mensagem | 02 § Tela 4 |
| 13-mural-selecionados | Modo Selecionados com grupo adicionado por alerta, aba "Pra você" | 02 § Tela 4 |
| 14-sessoes | Lista de sessões (excluir futura) + agendamentos liberados | 02 § Tela 5 |
| 14b-sessoes-realizadas | Realizadas: "No acervo de mentorias" / "Aguardando gravação" / individual fora do acervo | 02 § Ajustes 29/10 |
| 15-sessoes-nova-sessao | Formulário inline de nova sessão | 02 § Tela 5 |
| 16-intervencoes | Kanban com medidor do mês | 02 § Tela 6 |
| 17-intervencoes-drawer-card | Drawer do card: status, ações, histórico | 02 § Tela 6 |
| 20-estado-sem-simulado-inicio | V0: só alertas de engajamento | 02 § Estados |
| 21-estado-sem-simulado-minha-turma | V0: segmentos de engajamento, "Aguardando Metas", "Sem dado" | 02 § Estados |
| 22-estado-sem-simulado-detalhamento | V0: vazio "Nenhum simulado disponível" | 02 § Tela 3 |
| 23-estado-carregando-inicio | Skeletons com a faixa visível | 01 § Estados |
| 24-estado-erro-inicio | Faixa de erro + Tentar novamente | 01 § Estados |
| 25-mobile-390-inicio | Início a 390px: header fixo, faixa empilhada, avatares ocultos | 01 § Responsividade |
| 26-mobile-390-menu-aberto | Sidebar como drawer no mobile | 01 § Shell |

## B2B (`b2b/`)

| Arquivo | Tela / estado | Doc |
|---|---|---|
| 01-inicio | Faixa UniAtenas, visão geral da instituição, prioridades, próximas sessões, rotina do grupo | 03 § Tela 1 |
| 02-visao-geral | Visão Geral completa: projeção × observado, temas críticos (5 de 16), alunos | 03 § Tela 2 |
| 03-visao-geral-glossario | "Entenda as métricas" aberto | 03 § Tela 2 |
| 04-visao-geral-temas-expandidos | "Mostrar mais" aplicado + linha de tema aberta com ações | 03 § Tela 2 |
| 05-visao-geral-filtro-virada | Chegada por "Potencial de virada": tabela filtrada | 03 § Tela 2 |
| 06-drawer-aluno | Drawer B2B com orientação por perfil e "Sinalizar à IES" | 03 § Drawer |
| 07-detalhamento | Detalhamento B2B: Conceito e TRI projetados, régua do Gestor, Visão de alunos por limiar | 03 § Tela 3 |
| 08-detalhamento-drawer-grande-area | Drawer de grande área no B2B | 03 § Tela 3 |
| 09-sessoes | Sessões em ordem cronológica, próxima expandida com pauta | 03 § Tela 4 |
| 09b-sessoes-realizadas | Realizadas com estado do acervo | 03 § Ajustes 29/10 |
| 10-sessoes-nova-sessao | Formulário com descrição do formato | 03 § Tela 4 |
| 11-canais | Rotina do WhatsApp, Canais gerais, mural, comitê, banco de pérolas | 03 § Tela 5 |
| 12-canais-mural-erro-validacao | Mural em Canais com erro de validação | 03 § Tela 5 |
| 13-intervencoes | Kanban com filtro por perfil | 03 § Tela 6 |
| 20-estado-temas-sem-temas | Temas críticos vazio | 03 § Tela 2 |
| 21-estado-temas-lista-curta | 3 temas, sem expansão | 03 § Tela 2 |
| 22-estado-erro-inicio | Erro global | 01 § Estados |
| 23-estado-carregando-visao-geral | Skeletons da Visão Geral | 01 § Estados |
