# 02 · Mentor B2C (Tribos)

Protótipo: `prototipos/Mentor B2C.dc.html`. No painel de ajustes dá para trocar a **tribo** (Carcará, Camaleão, A Colmeia, Octopus) e o **estado dos dados** (completo, sem-simulado, carregando, erro).

Público: um mentor por tribo, cerca de 87 alunos. Pergunta central do mentor: **quem está longe da vaga que quer, quem sumiu e o que eu faço com isso esta semana.**

Menu: Início · *Minha mentoria*: Minha Turma · Detalhamento por Simulados · Mural · Sessões · Intervenções (com badge de cards em "A fazer").

---

## Tela 1 · Início

**Propósito:** em 10 segundos, saber o estado da tribo, quem precisa de contato e o que vem pela frente.

**Layout** (coluna, gap 24):
1. **Faixa da tribo** (`header`): raio 14, padding 14px 20px, `flex-wrap`, `align-items:center`, gap 12px 20px.
   - Fundo: `radial-gradient(circle at calc(100% - 40px) 50%, {sigA}, transparent 130px), linear-gradient(100deg, #160608 0%, {shadow} 100%)` + `inset 0 0 0 1px rgba(232,205,143,0.14)`.
   - Esquerda: eyebrow "Tribo {nome} · {lema}" (11px / 600 / uppercase / 0.16em, cor `glow`) e H1 "Boa tarde, {primeiro nome}" (22/700, branco). A saudação muda por horário: Bom dia (até 12h), Boa tarde (até 18h), Boa noite.
   - Ações: "Nova intervenção" (ghost, texto `#E8CD8F`, hover `rgba(255,255,255,0.07)`) → Intervenções com o formulário aberto; "Publicar no mural" (primária `#E8CD8F` com texto `#1A0509`) → Mural.
   - Direita: **ícone da tribo, 40px de largura**, `alt="Tribo {nome}"`.
2. **Visão geral da tribo** (bloco branco, borda `#E9EBED`, raio 12):
   - Cabeçalho: H2 + referência à direita ("5º Simulado PRO · 21/09") + link "Detalhar simulado" → Detalhamento com 5º selecionado.
   - 3 indicadores lado a lado, separados por divisória vertical `#F1F2F4`, padding 2px 20px: rótulo 12.5px `#414141`, valor 28/750, comparação 12.5px.
     - **Acima do corte** `34%` · "+6 p.p. vs 4º simulado" (verde)
     - **Acerto médio** `79%` · "+2 p.p. vs 4º simulado"
     - **Participação** `62 / 87` · "25 não fizeram" (texto 3)
3. Duas colunas (`flex: 2 1 520px` + `flex: 1 1 300px`, gap 16):
   - **Quem precisa de você**: lista; cabeçalho com "{n} alertas · hoje, 14h". Cada linha é um `<button>` em grid `20px | 1fr | avatares | 40px (n) | 64px (prioridade) | 20px (chevron)`, padding 11px 20px.
     | Alerta | Regra (texto da linha) | Prioridade | Ícone / cor |
     |---|---|---|---|
     | Sumiram | Sem acesso há 15 dias ou mais | Alta | `user-x` · danger |
     | Regrediram | Caíram 5 p.p. ou mais de acerto entre os 2 últimos simulados | Alta | `trending-down` · danger |
     | Estagnados | Variação menor que 2 p.p. nos 3 últimos simulados | Média | `arrow-right` · warning |
     | Não fizeram o 5º simulado | Simulado fechou em 21/09 | Média | `calendar-x` · neutro |
     Avatares: até 3 iniciais (24px, `#F4F5F6`) com sobreposição de -6px. Etiqueta de prioridade Alta `#F9E8E8`/`#771111`, Média `#FBF3E6`/`#7F5205`. Clique → Minha Turma filtrada pelo alerta (chip removível "Alerta: {nome} · {n}").
   - Coluna lateral:
     - **Próximas sessões** + "Ver agenda": o próximo encontro em destaque (dia/número + "Encontro da tribo · 19h" + tema). Se o encontro não tem link: "Falta link" em âmbar + ação "Adicionar link" (→ Sessões). Com link: "Link enviado à tribo" em verde. Depois, até 2 sessões em lista compacta.
     - **A fazer** ({n}) + "Abrir kanban": até 4 cards de "A fazer" (ícone do tipo, título 13.5/550, "{quem}"). Clique abre o drawer do card. Vazio: "Nada pendente."

**Estados**
- *Sem simulado (V0)*: indicadores viram engajamento: **Ativos na semana** `58 / 87` (+4 vs semana anterior), **Questões por aluno ativo** `142` (−9), **Sem acesso há 15+ dias** `11 alunos`. A referência vira "últimos 7 dias" e o link "Ver turma". Os alertas ficam só Sumiram e **Esfriando** (sem acesso entre 8 e 14 dias, prioridade Média). Faixa informativa: "Simulados ainda não disponíveis. Por enquanto, só alertas de engajamento." (`#E6F1F7`/`#024668`).
- *Carregando*: faixa da tribo visível; skeletons de 64px (indicadores) e 280px (colunas).
- *Erro*: faixa de erro global; a faixa da tribo e as ações continuam.

---

## Tela 2 · Minha Turma

**Propósito:** quem é cada aluno e a que distância está da vaga que quer.

**Cabeçalho:** H1 "Minha Turma" + botão secundário "Detalhar 5º Simulado PRO" (→ Detalhamento).

**Blocos:**
1. **Indicadores da turma**: faixa com 4 células (`auto-fit, minmax(200px,1fr)`), cada uma com título 13.5/650, hint 12px, valor 30/750, delta "vs anterior", régua 1º · anterior · atual e rodapé.
   - Possível aprovação `34%` (+6 p.p.) · régua 19% / 28% / 34% · "21 de 62 participantes do 5º simulado"
   - Acerto médio `79%` (+2 p.p.) · régua 72 / 77 / 79 · "média dos 62 participantes"
   - Questões na semana `142` (−9) · régua por semana (Sem −2 / Sem −1 / Atual)
   - Participação `62 / 87` (−9) · régua 80 / 71 / 62 · "25 não fizeram · fechou em 21/09"
2. **Onde a turma perde ponto**: matriz de grande área × prevalência.
   - Segmented: Turma toda · Acima do corte · Em variação · Abaixo (recalcula a matriz para o segmento).
   - Colunas: Grande área · Alta (62% da prova) · Média (28%) · Baixa (10%) · Geral · "Detalhar ›". Células 92px com raio 6.
   - Cor da célula: **≥ 78% verde, 66–77% âmbar, < 66% vermelho** (régua do handoff B2C; ver pendência P3).
   - **Temas críticos da turma** (mín. 30 respostas): tabela `# · Tema · Grande área · Prevalência · Acerto · Respostas · Alunos < 50% · [Intervenção]`. Mostra 5 e tem um botão "Ver todos os {n} temas críticos" / "Mostrar só os 5 primeiros". Acerto < 50% em `#771111`. "Intervenção" cria um card coletivo em A fazer + toast.
3. **Alunos**: busca por nome (input 36px), chip de alerta removível (vindo do Início) e chips de segmento:
   - Todos (87) · Constantemente acima do corte (21) · Em variação (44) · Constantemente abaixo (13) · Sem histórico (9).
   - Tabela (`min-width 920px`): Aluno (nome 13.5/600 + tag de segmento) · Semestre · acesso até · Meta · corte mais difícil ("Dermatologia" / "USP-SP · 84%") · % de acerto por simulado ("81% · 84% · 85% · 85% · **87%**", `–` quando não fez) · vs corte ("+3 p.p." verde / "−8 p.p." vermelho / "não fez") · Último acesso (vermelho e 650 quando ≥ 15 dias) · chevron.
   - Linha inteira abre o **drawer do aluno**; a linha aberta fica com fundo `#FFF7F7`.
   - Rodapé: "Mostrando {x} de {total}" + paginação Anterior/Próxima.
   - Vazio: "Nenhum aluno neste recorte" + "Limpar filtros".

**Estados**: em V0 a matriz e os temas somem; os segmentos viram Todos · Ativos (até 7 dias) · Esfriando (8 a 14) · Sumidos (15+), e "Acima/Abaixo do corte" ficam desabilitados com opacidade 0.45. Meta mostra "Aguardando Metas" e as colunas de desempenho mostram "Sem dado".

---

## Drawer · Aluno (B2C)

`min(560px,100%)`, à direita. Cabeçalho fixo; corpo rola.

- **Cabeçalho**: avatar 46px (iniciais), nome 18/700, linha "{ícone da tribo 20px} Tribo {nome} · {semestre} período · participou de {n} de 5 simulados", tag de segmento. Dados: Telefone · Acesso até · Meta mais difícil. Ações: WhatsApp · Mensagem no mural · Criar intervenção.
- **Liberar agendamento individual** (switch): desligado por padrão. Ligar abre um textarea obrigatório ("Mensagem individual"), com o selo "Falta 1 passo". "Enviar e liberar" publica a mensagem na aba "Pra você" do aluno, mostra o botão "Agendar com o mentor" (link do Google Agenda do mentor) e cria o card "Reunião individual" em A fazer. Sem mensagem: "Sem mensagem, a agenda não é liberada." Desligar remove o botão do aluno.
- **Notas dos simulados**: do mais recente ao mais antigo, 3 visíveis + "Ver todos os simulados". Linha: nome, "21/09/2026 · 87 acertos de 100", valor 17/700, "Acima do corte · +3 p.p." / "Abaixo do corte · −8 p.p.". **Cada linha é clicável** e abre o Detalhamento com aquele simulado selecionado.
- **Desempenho por área**: árvore Grande área → Especialidade → Tema, com barra de 110px e %. Expande/recolhe por chevron.
- **Log de interações**: filtros Tudo · Intervenções · Mural; item com ícone, texto, status ("A fazer", "Feito") e data. Vazio: "Nenhuma interação registrada ainda."

---

## Tela 3 · Detalhamento por Simulados

Base: tela 04/04b do handoff e o `Detalhamento.tsx` do Gestor. **Mesma estrutura do B2B** (ver `03-mentor-b2b.md` § Detalhamento para o que muda).

1. **Cabeçalho**: H1 "Detalhamento de simulados" (22/700) + "Escolha um ou mais simulados para ver o desempenho questão por questão." + link "Ver cronograma ›".
2. **Seletor de simulados**: **reusar `SeletorSimulados.tsx` sem mudanças.** Chips removíveis dos selecionados (`#FCE3E3`, borda `#B81414`); painel com "Sugestão: Comparar os 2 mais recentes", lista de disponíveis (checkbox azul `#0374AE`, linha selecionada `#FCE3E3` com faixa interna de 2px `#B81414`), lista "Ainda sem resultado" desabilitada ("Ainda não realizado" / "Previsto, sem data") e rodapé "{n} selecionados" + "Concluir". Esc fecha. Sem seleção: borda vermelha + "Escolha ao menos um simulado". Nota abaixo: 'Não existe "todos": o agregado da turma é a Minha Turma. Previstos ou em processamento ficam desabilitados.' Padrão ao entrar pelo Início: 4º + 5º.
3. **Como ler estes indicadores** (expansível): Percentual de acerto · Possível aprovação · Prevalência.
4. **3 indicadores** em cards (raio 14, padding 18px 20px), com valor 34/750 e rodapé com divisória:
   - Percentual de acerto médio (ponderado por participantes do recorte)
   - Possível aprovação + selo V1 · delta "+6 p.p. vs 4º" em pílula (só com 2+ simulados; senão "selecione 2 simulados para comparar")
   - Participação "fizeram o 5º simulado" `62 / 87`
5. Duas colunas:
   - **Acerto por prevalência**: 3 caixas (Alta · Média · Baixa com a média da coluna) + matriz grande área × prevalência (células 52px, régua 78/66) + "Detalhar ›" por linha → **drawer de grande área**.
   - **Diagnóstico da IA** (`BlocoInsights`): referência "4º e 5º simulados · atualizado em 21/09", selo "gerado por IA", resumo de 2 frases, "O que olhar primeiro" (lista numerada de 4), rodapé "Revise antes de compartilhar." + "Gerar de novo" (skeleton durante a geração) + "Levar pro mural" (abre o Mural com título e mensagem preenchidos para a turma toda).
6. **Visão de alunos** (`TabelaAlunosSimulado`): "{n} participantes · {m} sem participação", busca, abas Todos · Acima do corte · Próximo do corte (até 3 p.p. abaixo) · Longe do corte. Colunas: Aluno (caixa alta) · Semestre · Acertos · % de acerto · Corte da meta · Situação. Calculada no **simulado mais recente do recorte**. Clique abre o drawer do aluno.
7. **Detalhamento das questões** (`TabelaQuestoes`): "100 questões", filtro "Grande área:", ordenação Ordem da prova · Mais erradas · Mais acertadas. Colunas: chevron · Nº · Grande área · Especialidade · Tema · Índice de acerto (barra + %; ícone de alerta e `#771111` quando < 50%). Linha expandida:
   - Enunciado; alternativas com a correta em verde ("· alternativa correta") e o distrator dominante em vermelho com a etiqueta "distrator dominante".
   - Distribuição por alternativa (barra de 14px; correta `#149142`, dominante `#C61D1D`, demais `#6B7280`).
   - No distrator dominante: bloco "Quem marcou C · {n} alunos · mostrando 6", com nomes em grade e as ações **Criar intervenção** e **Mensagem pra quem marcou C** (primária; abre o Mural em "Selecionados" já com o grupo).
   - Legenda: correta · distrator mais marcado · leitura em uma linha.

**Drawer · Grande área** (`DrawerTemasDetalhamento`): "Grande área / {nome}", "Percentual de acerto por especialidade, nos simulados do recorte ({4º e 5º}). Acerto puro, sem nota de corte." Card por especialidade: nome 15/650, etiqueta de nível (crítico < 50 / mediano 50–79 / excelente ≥ 80), %, barra de 8px, "{n} respostas", "Ver temas ›". Temas: nome · respostas · % · botão "Intervenção".

**Estados:** sem simulado → bloco vazio tracejado "Nenhum simulado disponível". Sem seleção → só o seletor com erro. IA gerando → 3 linhas de skeleton.

---

## Tela 4 · Mural

**Propósito:** publicar para a tribo toda ou para alunos selecionados. O que é publicado aparece na home do aluno.

- **Nova publicação** (coluna principal):
  - Tag: Desempenho · Aviso · Fique por dentro (ver pendência P2).
  - Para quem: cartões de rádio "Toda a turma · 87 alunos" / "Selecionados · aba Pra você". Em Selecionados: atalhos "Adicionar por alerta" (Sumiram · 11, Regrediram · 6…) + chips removíveis; vazio: "Nenhum aluno selecionado".
  - Título (obrigatório), Mensagem (obrigatória), botão de link (abre URL + título do link, obrigatório se houver URL), anexar arquivo.
  - Checkbox "Registrar como intervenção (Mensagem · {n} alunos)", marcado por padrão.
  - "Salvar rascunho" + "Publicar para {n} alunos".
  - Validação: erros inline em vermelho embaixo de cada campo ("Informe o título.", "Escreva a mensagem.", "Selecione pelo menos um aluno.", "Link inserido precisa de título."). Sucesso: toast "Publicado para {n} alunos · registrado em Intervenções" e a publicação entra no topo de Publicadas.
- **Como o aluno vê** (coluna lateral): prévia ao vivo com "{ícone 24px} Mural da Tribo {nome}", abas Coletivo / Pra você (Pra você só aparece no modo Selecionados), card com tag, "agora", título, mensagem, link e "{mentor} · Tribo {nome}".
- **Publicadas**: filtro por tag; linhas com título, tag, destinatário e data.

## Tela 5 · Sessões

- Cabeçalho + "Nova sessão" (primário).
- Filtros: Todas · Encontros da tribo · Individuais; segmented Próximas / Realizadas.
- Formulário inline (fundo `#FFF7F7`, borda `#F3C9C9`): tipo (Encontro da tribo / Individual), aluno (só individual), data, hora, tema (obrigatório), link do Meet (só encontro, opcional). Dica dinâmica: "Encontro da tribo avisa a turma no mural. Sem link, fica marcado Falta link." / "Individual entra no kanban como Reunião individual."
- Tabela: Data (dia + hora) · Tipo (ícone + "Encontro da tribo"/"Individual") · Com quem · Tema · Link ("Falta link" âmbar; "agenda do mentor"; URL em verde) · Após a sessão ("Marcar feita" nas individuais futuras → move o card para Feito; nas realizadas: "Gravação publicada no mural" / "Adicionar gravação").
- **Agendamento individual liberado para {n} alunos**: lista com avatar, nome, "desde {data} · mensagem enviada", switch para desligar e "Desligar todos". Vazio: "Nenhum aluno com agenda liberada."

## Tela 6 · Intervenções (kanban)

- Período: Esta semana / Quinzena / Mês (+ intervalo de datas); filtro de tipo: Todos · Individual · Coletiva · Mensagem.
- **Medidor**: "{feitas} de 15 intervenções planejadas realizadas em outubro", 15 marcadores (verde = feita), "faltam {n} até 31/10". A meta de 15 é hipótese (P6).
- Colunas A fazer (dot `#C3C6C6`) · Em andamento (`#D38808`) · Feito (`#149142`), fundo `#EDEEF0`, raio 12, padding 10.
- Card: tipo (ícone + "Reunião individual"/"Reunião coletiva"/"Mensagem") + data, título 13.5/600, nota opcional, "{quem}" + origem ("Auto · agenda liberada", "Auto · tema crítico", "Auto · mural", "Auto · sessão criada", "Manual").
- "Nova intervenção" abre um card-formulário no topo de A fazer: tipo, para quem (obrigatório: "Diga para quem é a intervenção."), descrição opcional.
- **Drawer do card**: tipo · origem, título, contexto do aluno/grupo, status em segmented (A fazer / Em andamento / Feito; cada mudança vai para o histórico), WhatsApp, Mensagem no mural, histórico com comentários.
- Sem drag-and-drop no protótipo; em produção, avaliar arrastar entre colunas mantendo o segmented do drawer como alternativa acessível.

---

## Ajustes de 29/10 (reuniões de 13/10 e 22/10)

Ver `05-decisoes-e-pendencias.md` § Ajustes das reuniões. As capturas em `capturas/` foram refeitas em 04/11 e já mostram estes ajustes.

- Minha Turma: coluna "Semestre · acesso até" vira "Questões · acesso" ("{n} em 30 dias" / "acesso até {mês}"). Visão de alunos: "Semestre" vira "Último acesso".
- Drawer: sem semestre; bloco "Consumo no Flix · últimos 30 dias" (Questões feitas · Acerto em questões · Aulas assistidas · PDFs) acima das notas.
- Mural: Publicadas com Editar (carrega no composer; salva como "· editada") e Excluir. Seção nova "Canais da tribo": Grupo de avisos e Plantão de dúvidas (fixos, cadeado) + Grupo da tribo (link editável, valida `chat.whatsapp.com/`).
- Sessões: coletiva realizada mostra "Aguardando gravação" ou "No acervo de mentorias"; individual "Feita · não vai para o acervo"; futura tem botão de excluir.
