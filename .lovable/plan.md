# Restringir a experiência de gestão aos simulados ENAMED

Hoje a tabela `simulados_admin` tem 124 registros: 52 com `type = 'simulado_enamed'` e 72 com `type = 'trilha'` (nenhum registro sem `type`). As telas de gestão enumeram simulados sem olhar essa coluna, então trilhas entram nos seletores, nos KPIs, no cronograma e nas comparações — poluindo a leitura do gestor.

## O que muda

Toda a experiência de gestão passa a considerar apenas simulados com `type = 'simulado_enamed'`:

- Seletor de simulados (portal novo e dashboard institucional antigo)
- Visão Geral: KPIs, evolução institucional, proficiência por semestre
- Detalhamento por simulados e detalhamento de questões
- Diagnóstico curricular (áreas e temas)
- Visão de alunos e drawer do aluno (participações, evolução, desempenho por área)
- Cronograma de simulados
- Exportações (PDF/XLSX), que consomem os mesmos dados

Trilhas continuam intactas para o aluno e para o Admin — nada é apagado nem alterado nos dados.

## Como será feito (técnico)

Migration única, apenas `CREATE OR REPLACE FUNCTION`, adicionando o predicado `type = 'simulado_enamed'` onde `simulados_admin` é lida, preservando assinatura, `SECURITY DEFINER`, `search_path` e os `GRANT`/`REVOKE` atuais de cada função:

Portal novo do gestor:
- `get_gestor_visao_geral`
- `get_gestor_detalhamento`
- `get_gestor_detalhamento_temas`
- `get_gestor_diagnostico`
- `get_gestor_diagnostico_temas`
- `get_gestor_alunos`
- `get_gestor_aluno`
- `get_gestor_aluno_desempenho_por_area`
- `get_gestor_questoes`
- `get_gestor_cronograma`

Dashboard institucional (portal antigo, ainda em uso por IES sem `gestao.portal_v2`):
- `get_institutional_simulados`
- `get_institutional_performance`
- `get_institutional_evolution`
- `get_institutional_evolution_tri`
- `get_institutional_student_scores`

Observação sobre o cronograma: os slots previstos vêm de `ies_simulado_previsto`/`ies_contrato_simulados`. Um slot cujo `simulado_id` aponte para uma trilha passa a ser tratado como slot ainda não realizado, em vez de exibir a trilha como simulado aplicado.

Não haverá alteração em `src/` — o filtro fica no banco, que é a fonte usada por todas essas telas. Depois de aplicar, verifico por IES que nenhum simulado com `type = 'trilha'` aparece nos envelopes das RPCs e que as contagens de simulados batem com o esperado.
