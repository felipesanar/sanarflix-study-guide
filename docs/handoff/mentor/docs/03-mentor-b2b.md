# 03 · Mentor B2B (Instituições)

Protótipo: `prototipos/Mentor B2B.dc.html`. No painel de ajustes dá para trocar o **estado dos dados** (completo, carregando, erro) e o dos **temas críticos** (lista longa, lista curta, sem temas, carregando).

Público: um mentor por IES (ou por recorte da IES; ver P9). No exemplo, Beatriz Câmara, UniAtenas Paracatu, 186 alunos. Pergunta central: **quantos alunos consigo levar acima de 60 até a prova, e o que levo para a próxima sessão.**

Menu: Início · *Minha mentoria*: Visão Geral · Detalhamento por Simulados · Sessões · Canais (badge quando a rotina do dia está pendente) · Intervenções (badge de A fazer).

### O que veio do B2C e como mudou

| Componente B2C | No B2B | Por quê |
|---|---|---|
| Shell, drawer do aluno, kanban, mural, busca, chip de filtro vindo do Início | **Mantido** | Mesmo trabalho operacional |
| Alertas "Quem precisa de você" | **Adaptado** → Prioridades de acompanhamento (3 perfis do planejamento + Sem acesso recente) | Planejamento B2B define a ordem: virada primeiro |
| Segmentos por corte da meta | **Adaptado** → grupos de evolução do Gestor (consistentemente proficiente / em variação / consistentemente não proficiente) | No B2B não há meta individual; o limiar é 60 |
| Possível aprovação, vs corte | **Substituído** → Conceito ENAMED previsto, TRI projetado, Alunos proficientes | Indicadores institucionais |
| Encontro mensal da tribo | **Substituído** → Pós-simulado e Oficina de questões (quinzenal) | Contrato B2B |
| Identidade da tribo, metas, régua 78/66 | **Removido** | Não se aplica; a régua do B2B é a do Gestor (crítico < 50, excelente ≥ 80) |
| — | **Novo**: Canais (WhatsApp da IES, mural, banco de pérolas, comitê pedagógico) | Pedido do Léo (14/10) |

---

## Tela 1 · Início

1. **Faixa da IES**: mesma anatomia da faixa B2C (raio 14, padding 14px 20px), com o tema UniAtenas (`01-fundamentos.md`). H1 "Boa tarde, Beatriz". Ações: "Rotina do grupo" (ghost, `#FFD6A6`) → Canais; **"Preparar sessão"** (primária `#F8941C`) → Sessões com a próxima sessão aberta. Direita: selo Paracatu 48×48 com a tocha.
2. **Visão geral da instituição**: H2 + selo "projetado" + referência "4º simulado · 01/10" + link "Ver análise completa" → Visão Geral. Três indicadores com divisória (padding 2px 20px, rótulo 12.5px, valor 28/750):
   - **Conceito ENAMED previsto** ▢ `3 / 5` · "igual ao 3º simulado"
   - **TRI projetado** ▢ `58,4 / 100` · "+1,2 vs 3º simulado" (verde)
   - **Alunos proficientes** `52%` · "89 de 171 participantes" (observado, sem selo)
   (▢ = marcador tracejado de 9px "Projetado")
3. Duas colunas:
   - **Prioridades de acompanhamento** ("4 grupos"): linhas-botão em grid `20px | 1fr | 40px | 64px | 20px`.
     | Grupo | Critério | Prioridade | n |
     |---|---|---|---|
     | Potencial de virada | Proficiência 52–59 no último simulado | Alta | 23 |
     | Desempenho muito baixo | Proficiência abaixo de 45 ou queda de 5+ | Alta | 18 |
     | Sem acesso recente | Sem acesso há 15+ dias | Média | 9 |
     | Desempenho muito bom | Proficiência 70+ nos 2 últimos | Baixa | 31 |
     Etiqueta Baixa: `#F4F5F6`/`#414141`. Clique → Visão Geral com o chip "Perfil: {grupo} · {n}" na tabela de alunos.
   - Coluna lateral:
     - **Próximas sessões** + "Ver agenda": a próxima em destaque (fundo `#FFF9F2`, dia em `#B8430C`, número 22/750, "{tipo} · {hora}", tema, status e ação contextual: "Adicionar link" quando falta link, "Definir pauta" quando a pauta está pendente, senão "Abrir sessão"), seguida das demais em lista compacta. Ordem cronológica.
     - **Grupo da turma · semana** + "Abrir canais": Ter (enquete / desafio de imagem), Qui (resposta + comentário), Sex (pérola). Feito = círculo verde com check; pendente hoje = ação "Marcar enviado"; futuro = "Amanhã".

---

## Tela 2 · Visão Geral

**Cabeçalho:** H1 "Visão Geral" + seletor de **período** (segmented): Últimos 30 dias · Últimos 90 dias · Últimos 6 meses (padrão) · Ciclo 2026, com resumo "{n} simulados no período" e o link "Detalhar este simulado ›" (→ Detalhamento com o último simulado do período). Os indicadores refletem o simulado mais recente do período e comparam com o primeiro do período; com só 1 simulado, régua e delta somem.

1. **Projeção para o ENAMED** (bloco):
   - Cabeçalho "estimativa · não é resultado oficial do INEP" + "Entenda as métricas" (abre um glossário inline com Conceito ENAMED previsto, Proficiência 0 a 100, Proficiente, Percentual de acerto).
   - 2 indicadores com selo "projetado", valor 34/800, delta, régua e rodapé:
     - Conceito ENAMED previsto (escala 1 a 5) · "{pct}% de proficientes no {n}º simulado"
     - TRI projetado (proficiência média · escala 0 a 100) · "Faltam {x} pontos para a média da turma chegar ao corte de proficiente." Valor fica verde quando ≥ 60.
   - **Evolução da proficiência média**: linha `#941F1F` de 2px com pontos (círculo branco de raio 3.5), rótulo do valor acima de cada ponto, eixo com 1º…4º e linha tracejada `#C3C6C6` no 60 ("tracejado = proficiente (60)"). Máx. 420px. SVG simples; não precisa de biblioteca de gráfico.
2. **Resultados observados** (faixa sem selo, rótulo "observado"): Alunos proficientes `52%` "89 de 171" · Percentual de acerto `61,8%` · Participação `171 / 186` · Simulados realizados `4 de 6 contratados` (6 marcadores, verde = realizado; "5º fecha em 31/10").
3. **Temas críticos da turma** (pedido do Léo: passar de 5):
   - Cabeçalho com a contagem total; filtros "Grande área" (select) e "Ordenar por": **Impacto na prova** (padrão; peso da prevalência Alta 3 / Média 2 / Baixa 1 × (100 − acerto)) · Menor acerto · Mais alunos abaixo de 50%.
   - Tabela (`min-width 820px`): # · Tema (+ especialidade) · Grande área · Prevalência · Acerto da turma (barra + %) · Respostas · Alunos < 50% · chevron. Critério de entrada: 30+ respostas da turma no recorte e acerto < 50%.
   - **Expansão:** mostra 5; "Mostrar mais 5 (faltam {n})" soma de 5 em 5 até o total; "Recolher para os 5 primeiros" volta. Trocar filtro volta para 5.
   - **Linha expandida** (fundo `#F9FAFB`): evolução no tema ("2º: 44% → 3º: 41% → 4º: 38%"), questões do tema no simulado, e as ações **"Levar para a próxima oficina (19/11)"** (vira "Na pauta da oficina" em verde e fica desabilitado) e **"Criar intervenção"**.
   - Legenda: crítico < 50% · mediano 50% a 79%. Rodapé: "Mostrando {x} de {y}".
   - Estados: carregando (3 linhas skeleton de 44px) · lista curta (3 temas, sem botão de expandir) · sem temas ("Nenhum tema crítico neste recorte" + "Nenhum tema abaixo de 50% de acerto.").
4. **Alunos**: busca, chip de perfil removível (vindo do Início) e chips de grupo: Todos (186) · Consistentemente proficiente (61) · Em variação (52) · Consistentemente não proficiente (58) · Sem resultado (15). Tabela: Aluno (nome + tag de grupo + tag de perfil, se houver) · Semestre · Proficiência 1º → 4º ("61 · 63 · 64 · **66**", `—` quando não fez) · Acerto 4º · Último acesso · chevron. Rodapé: "Mostrando {x} de {total} · — = não participou".

**Regra de grupo** (`regras.ts`): só com simulados válidos (não nulos); todos ≥ 60 → proficiente; nenhum ≥ 60 → não proficiente; misto → em variação; nenhum válido → "—".

---

## Drawer · Aluno (B2B)

`min(520px,100%)`. Avatar, nome, "{sem} semestre · UniAtenas · participou de {n} de 4 simulados", tag de grupo + tag de perfil. Quando há perfil, aparece a orientação (fundo `#F9FAFB`):
- **Potencial de virada**: "perto da proficiência; é onde cada contato mais move o indicador da IES. Priorize conversa individual e um plano para o próximo simulado."
- **Desempenho muito baixo**: "entenda o que está acontecendo e avalie se a mentoria ou a IES podem ajudar. Comunique a preocupação à coordenação."
- **Desempenho muito bom**: "contato pontual de incentivo e sondagem. Menor prioridade, mas não fica sem contato."

Ações: WhatsApp · Criar intervenção (leva o perfil para o card) · **Sinalizar à IES** (entra nas sinalizações do comitê; depois vira "Sinalizado à IES", desabilitado). Lista de simulados do mais recente ao mais antigo: valor e situação (Proficiente verde / Abaixo do limiar vermelho / Não participou).

---

## Tela 3 · Detalhamento por Simulados

**Mesma estrutura e componentes do B2C** (`02-mentor-b2c.md` § Tela 3). Diferenças:

| Parte | B2B |
|---|---|
| Seleção padrão | 3º + 4º Simulado ENAMED; 5º "Ainda não realizado" (31/10); 6º "Previsto, sem data" |
| Nota do seletor | 'o agregado do período é a Visão Geral' |
| Como ler | Percentual de acerto · Conceito e TRI projetados (não é resultado oficial do INEP; proficiente = 60+) · Prevalência |
| Indicadores | Percentual de acerto médio · **Conceito ENAMED** ▢ `3 / 5` ("52% de proficientes no 4º Simulado") · **TRI projetado** ▢ `58,4 / 100` (+1,2 vs 3º; "faltam 1,6 para 60") |
| Cores da matriz | Régua do Gestor: < 50 vermelho, 50–79 âmbar, ≥ 80 verde |
| Diagnóstico da IA | Mesma estrutura; o texto fala de TRI e de potencial de virada. "Levar pro mural" → Canais com o formulário do mural aberto |
| Visão de alunos | Colunas % de acerto · Proficiência · Limiar (60). Abas: Proficiente · Potencial de virada (52–59) · Abaixo do limiar |
| Questões | Botão no cabeçalho: **"Levar para a oficina de 19/11"** (→ "Na pauta da oficina de 19/11", verde). Adiciona "20 questões mais erradas do {simulado}" à pauta. "Mensagem pra quem marcou" → mural em Canais |

---

## Tela 4 · Sessões de mentoria

Fonte: planejamento pedagógico B2B (11/10). Contrato UniAtenas: **2 encontros síncronos por mês**.

- Faixa de ciclo: "Contrato UniAtenas: 2 encontros síncronos por mês" + "Out: {x} de 2 realizados" (dot âmbar enquanto não fecha) + "Nov: 2 de 2 agendados" (dot verde).
- **Nova sessão** (formulário inline): tipo Pós-simulado · Oficina de questões · Individual, com descrição do formato:
  - Pós-simulado: "Discussão dos temas mais críticos do simulado. Pauta sugerida: as 20 mais erradas e os distratores."
  - Oficina: "Prática ativa: 5 questões pré-teste → comentário → ficha resumo → 5 pós-aula. Alunos votam a alternativa no chat."
  - Individual: "Reunião com um aluno. Entra no kanban como Reunião individual."
  Campos: aluno (individual), data dd/mm (obrigatória e validada: "Informe a data da sessão."), hora (padrão 20h), tema/pauta, link do Meet. Aviso se o mês já tem 2 coletivas: "Já há 2 sessões coletivas neste mês. O contrato prevê 2; uma terceira não conta no ciclo."
- Filtros: Todas · Pós-simulado · Oficina de questões · Individuais; Próximas / Realizadas.
- **Linha de sessão (expansível)**: dia/número/hora · tipo (ícone `clipboard-check` / `book-open` / `user`) · tema + subtítulo · status (Agendada, **Falta link**, **Pauta pendente**, Falta link e pauta, Realizada; âmbar quando há pendência) · chevron. A próxima abre expandida.
- **Expandida** (fundo `#F9FAFB`):
  - **Pauta** (coletivas): itens com ícone, texto ("Vigilância em saúde · 38% de acerto"), origem ("tema crítico" / "Detalhamento") e × para remover. Os itens chegam pelos botões "Levar para…" da Visão Geral e do Detalhamento. Vazio: "Sem itens na pauta."
  - Sem link: input "Colar link do Meet" (com mais de 10 caracteres o status deixa de ser "Falta link"). Com link: URL em verde.
  - "Marcar realizada" → cria o card em Feito + toast.
  - Realizadas: "Gravação publicada no mural" / "Sem gravação anexada".
- Presença **não** é exibida: o Academy não recebe esse dado.

## Tela 5 · Canais

Fonte: planejamento B2B (assíncrono) + pedido do Léo. **O Academy não envia nada no WhatsApp**: o mentor envia no app e marca aqui; a marcação alimenta o log da semana.

- **Grupo de WhatsApp · PRO ENAMED UniAtenas** (coluna principal): "Rotina semanal de 12 a 16/10 · 1 enquete e 1 pérola por semana" + "Abrir grupo ↗" (link externo para o WhatsApp Web/app).
  | Dia | Ação | Conteúdo / dica |
  |---|---|---|
  | Terça | Enquete / desafio de imagem | ECG (banco de pérolas) · "Resposta só depois da votação." |
  | Quinta (hoje) | Resposta + comentário do mentor | Gabarito comentado · "Sem o seu comentário, o engajamento da enquete cai." |
  | Sexta | Pérola de conhecimento | Material do time pedagógico · "Baixe e envie como seu; não use 'encaminhar'." |
  Status: Enviado (verde) · Pendente · hoje (âmbar, linha `#FFFCF5`, botão "Marcar como enviado") · Amanhã. Rodapé: 'Envie como seu, sem "encaminhar".'
- **Mural no Academy** (lateral): "Nova publicação" abre tag (Desempenho/Aviso/Fique por dentro), título, mensagem e "Publicar para 186"; erro "Título e mensagem são obrigatórios."; histórico das últimas publicações.
- **Comitê pedagógico · UniAtenas** (lateral): data ("Ter, 28/10 · 15h com a coordenação do curso") e "Sinalizações à IES · {n}" (nome, motivo, data), alimentadas pelo drawer do aluno.
- **Banco de pérolas · rodízio entre mentores**: tabela Semana · Mentor responsável · No mural em · Tema · status. A linha do mentor logado fica destacada (`#FFF7F7`, "(você)", "Sua vez · propor até 23/10").

## Tela 6 · Intervenções

Mesmo kanban do B2C, com duas diferenças: filtro por **perfil** (Todos · Potencial de virada · Muito baixo · Muito bom) e a tag de perfil no card. Mover entre colunas por botões "→ Em andamento" / "→ Feito" no card (sem drawer no protótipo B2B; em produção, usar o mesmo drawer do B2C).

---

## Ajustes de 29/10 (reuniões de 13/10 e 22/10)

Ver `05-decisoes-e-pendencias.md` § Ajustes das reuniões. As capturas em `capturas/` foram refeitas em 04/11 e já mostram estes ajustes.

- Canais: bloco "Canais gerais" (Grupo de avisos, Plantão de dúvidas; fixos) acima do Mural.
- Drawer: bloco "Consumo no Flix · últimos 30 dias".
- Sessões: "Aguardando gravação" / "No acervo de mentorias"; individual não vai ao acervo.
- Turma: recorte por contrato (campus ou ano), sem escolha nem troca.
