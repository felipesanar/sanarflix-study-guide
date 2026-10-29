# Handoff — Cartão com nome e matrícula impressos (PRD rev. 8) e Fase 2 sem banco

- **Data:** 20/10/2026
- **Resultado: concluído no código.** Falta o aceite físico (imprimir e escanear) e o piloto real.
- **Branch:** `feat/cartoes-matricula` (de `feat/cartoes-resposta`, commit `032259af`). **Tag:** `cartoes-matricula`. Nada foi enviado ao GitHub.
- **Pasta:** `C:\Users\joao.nader\work\sanarflix-cartoes-matricula`.
- **Testes:** `services/cartao-omr` → **222 passed** (eram 140); front, `src/features/cartoes` → **280 passed** (eram 192; filtro de semestre e plano B por e-mail, 21/10, somaram o resto); `tsc` do app: 0 erros. A suíte inteira do front tem as 35 falhas antigas do Portal do Gestor (também na `main`), fora do escopo.
- **Portões de produção:** nenhum. Não houve consulta nem escrita no Supabase, nem migration. **Não foi preciso criar o papel `cartao_omr_reader`.**

## 1. Decisões do João (20/10/2026)
1. **UniAtenas segue como hoje** (cartão único; matrícula em bolhas + nome manuscrito; sem e-mail). Teste de guarda: o template `uniatenas_v1.json` e a lista de desenho saem iguais aos do commit anterior (só mudou o texto descritivo `qr.payload_format`), e o PDF gerado é igual ao do código antigo.
2. **Identificação pela máquina: QR com a matrícula** (`SFA2:M:<SIM8>:<MATRICULA>`). Código de barras e OCR foram descartados (sem correção de erro; OCR confunde 0/O e 1/I e quebra com rasura).
3. **Aluno sem matrícula utilizável: bloquear e listar.** Não há fallback com ID nem cartão genérico.
4. **Fase 2 sem banco:** o leitor só lê o PDF; a coluna 1 da planilha é a matrícula.

## 2. O que foi feito
### Cartão (Python)
- `models.py`: tipo de QR `M` (matrícula) no lugar do `S` (`user_id`); `normalize_matricula` (`trim` + maiúsculas) e `matricula_problem` (`sem_matricula`, `formato_nao_suportado`). Alfabeto `[A-Z0-9./-]`, 1 a 24 caracteres (todo o payload cai no modo alfanumérico do QR; versão 3 no pior caso, módulo ≥ 0,75 mm).
- `layout.py` / `drawlist.py` / `card.py`: template **`sfa_v3`** (`sfa_v2.json` removido). O quadro à esquerda virou **MATRÍCULA**, com a matrícula impressa em Courier-Bold (16 pt, encolhe até 9 pt) e os avisos (conferir nome e matrícula, avisar o aplicador, não trocar de cartão, não cobrir o QR). Slot novo `matricula`; `draw_version` **por layout** (sfa 2, uniatenas 1); `crops_mm.matricula_impressa`. O rótulo sob o QR passou a ser a matrícula.
- `roster.py`: CSV `matricula,nome[,ies]`, normaliza e recusa matrícula repetida ou fora do formato.
- `PageResult`: `matricula_qr` e `identificacao` (QR no `sfa`, bolhas no UniAtenas), `rect` opcional (`keep_rect`) para os recortes.

### Emissão (TypeScript, `src/features/cartoes/`)
- `payload.ts` (espelho do `models.py`), `types.ts`, `render.ts` (slot `matricula`, fonte `Courier-Bold`), `templates.ts` (`sfa_v3`), `emitir.ts`:
  - `classificarAlunos`: **aptos** × **excluídos** (`sem_matricula`, `formato_nao_suportado`, `duplicada`). Matrícula repetida exclui **todos** os envolvidos.
  - `montarSpecs` também recusa o que não pode ser impresso e matrícula repetida na lista (defesa em profundidade).
  - `csvDosExcluidos` (nome;matricula;motivo) e `csvDaEmissao` (matricula;nome), `;` com BOM.
- Tela (`CartoesTab.tsx`): só os aptos têm caixa de seleção; painel âmbar "N alunos ficam fora do PDF", com motivo e **Baixar CSV**; após gerar, **Baixar lista da emissão (CSV)**; textos atualizados.

### Leitor e planilha (Fase 2 sem banco)
- `processar.py` + `export_xlsx.py` + comando **`cartao-omr processar <pdf> --simulado <id> [--questoes N] [--lista csv] [--layout uniatenas] [--saida pasta]`**.
- Planilha `respostas_<simulado>.xlsx`: 1ª aba `Respostas` com exatamente `1 + N` colunas (coluna 1 `matricula_ra_ou_id`, em texto), `A`–`D` ou vazio; dúvidas em branco, amarelas e com comentário. Abas `Pendências`, `Não identificados`, `Resumo`; mais `recortes/` (nome e bloco da matrícula, ou a página inteira reduzida) e `relatorio.json`.
- Pendências: `pagina_ilegivel`, `qr_ilegivel`, `matricula_invalida` (UniAtenas), `simulado_divergente`, `aluno_duplicado` (todas as páginas envolvidas saem de `Respostas`), `multipla`, `ambigua`, `resposta_alem_do_simulado`, `fora_da_lista`. **Saíram** `aluno_nao_identificado` e `aluno_fora_do_roster`.
- Teste de compatibilidade com a importação: espelho Python de `parseMatrizRespostas` (1ª aba, por posição, 1 + N colunas, A–E, sem repetição), para N = 100 e 90.

### Fixtures, vetores e dependências
- Fixtures `sfa_*` regeneradas (matrículas fictícias, algumas com letra e pontuação) e `roster_ficticio.csv`; **os binários mudaram no Git (~5 MB)**. `uniatenas_realista` não foi regenerada (continua válida).
- `qr-golden.json` regenerado (`tools/gen_qr_golden.py`): payloads `M` com matrículas de 1 a 24 caracteres.
- `pyproject.toml`: removidos `psycopg[binary]` e `rapidfuzz`; `.env.example` removido.

## 3. Como foi verificado
- `eval_accuracy.py` sobre as fixtures: 100% (acerto por bolha, QR 22/22, matrícula 3/3, 0 ilegíveis com rotação ≤ ±5°).
- Paridade Python × TypeScript: QR idêntico pixel a pixel, texto da matrícula no PDF do TS, marcadores e bolhas no lugar, leitor da Fase 1 lê o PDF gerado pelo TS (matrícula do QR e 100 questões em branco).
- O cartão novo foi renderizado e visto (matrícula legível, avisos dentro do quadro, rótulo sob o QR).

## 4. O que NÃO foi verificado
- **Impressão e escaneamento reais** (aceite físico). Os limiares do OMR continuam sem confirmação real (ver `fase-1.md`, seção 3).
- **Dados reais:** não consultei `users` para dimensionar quantos alunos ficam de fora por IES. A consulta de 13/10 (B2B, B2C, Claretiano, FAI, UEA, USCS sem `matricula_ra`; ~15% do UniAtenas sem matrícula; 5 × `99-G-99999`) indica que **várias IES não conseguem emitir até o cadastro ser corrigido**. Uma consulta somente leitura em `users` por IES daria o número exato (precisa da sua aprovação).
- **A tela com o seu login:** foi testada só com dados simulados (vitest). Na primeira vez, conferir o painel de excluídos de uma IES pequena.
- Matrícula igual em duas IES do mesmo simulado: a tela só vê a IES escolhida; quem acusa é o dry-run da importação (`ra_ambiguous`).

## 5. Desvios do plano e decisões pequenas
- `qr.payload_format` do `uniatenas_v1.json` mudou (texto descritivo), então o JSON não é byte a byte o antigo; a geometria, o `draw` e o PDF são idênticos.
- `exemplo_uniatenas.pdf` ficou como estava no Git (o PDF versionado já divergia do gerador por detalhe de compressão; o conteúdo é o mesmo).
- Sem paralelismo no `processar` (~0,11 s por página; 500 cartões ≈ 1 min). `ProcessPoolExecutor` fica para quando incomodar.
- `--questoes` é obrigatório na prática para simulados com menos de 100 questões: sem o banco o script não descobre `total_questoes`.

## 6. Próximos passos
**Meus (Claude):**
1. Se você aprovar, uma consulta **somente leitura** em `users` (contagem por IES de matrícula vazia, fora do formato e repetida), para dizer quais IES já podem emitir.
2. Fase 3 (piloto): rodar o leitor no material real, calibrar `T_ALTO`/`T_BAIXO`/`T_INK`, escrever o runbook e o guia de 1 página para as IES.
3. Se pedido: paralelizar o `processar`; investigar as 35 falhas antigas do Gestor na `main`; o backlog de segurança (F1, F2, F4, F5).

**Do João:**
1. **Push** da branch e da tag `cartoes-matricula` (comandos na resposta da sessão).
2. **Abrir a tela com seu login** (Admin → Simulados → Cartões-resposta), escolher uma IES pequena e conferir: quantos alunos aparecem, quem ficou de fora e por quê, o CSV dos excluídos.
3. **Aceite físico:** gerar um cartão pela tela, imprimir em A4 a 100%, preencher, escanear a 200 e 300 dpi e rodar `cartao-omr processar` no PDF; abrir o xlsx e fazer o dry-run da importação (sem confirmar o commit real).
4. Corrigir os cadastros sem matrícula (P3: UniAtenas ~15%, 5 × `99-G-99999`; IES sem `matricula_ra`) com o Relacionamento; confirmar os campi UniAtenas (P2); avisar as IES do cartão novo (P5).
5. Para o piloto: simulado de teste, voluntários e gabarito conhecido, escaneados em 200 e 300 dpi.

## 7. Adendo de 21/10/2026 — filtro de semestre na tela de emissão
Pedido do João, depois de testar a UVA (cartões gerados e lidos com a matrícula certa e as 100 questões em branco): uma IES costuma aplicar o simulado só em alguns semestres.
- **Fonte:** `users.semestre` (inteiro, opcional), lido junto com a lista de alunos (`api.ts`). Sem migration e sem escrita.
- **Tela:** linha "Semestre" com um botão por semestre existente e a contagem de alunos (`6º (1)`, `7º (3)`, `Sem semestre (1)`); vários podem ser marcados juntos; "Limpar filtro" volta a todos. Sem nenhum marcado, vale todos. O filtro só aparece se a IES tiver mais de um valor. Zera ao trocar de simulado ou de IES.
- **Efeito:** o filtro vale para a lista, a contagem, o PDF, o painel dos excluídos e o CSV dos excluídos (que ganhou a coluna `semestre`). Trocar o filtro **remarca todos** os alunos dos semestres escolhidos (desmarcações manuais voltam ao padrão). O PDF só leva quem está marcado **e** dentro do filtro.
- **Arquivo:** o nome ganha o sufixo do filtro, por exemplo `cartoes_uva_1o-simulado_sem-6-7.pdf`; a lista da emissão (CSV) acompanha o mesmo nome e só traz quem recebeu cartão, então o `processar --lista` aponta como "sem cartão" apenas quem estava no filtro.
- **Código:** `src/features/cartoes/semestre.ts` (puro), `CartoesTab.tsx`, `api.ts`, `emitir.ts` (`nomeDoArquivo` e `csvDosExcluidos`); testes em `semestre.test.ts` e `CartoesTab.test.tsx`.
- **Não verificado:** a tela com login real (só vitest). Dados de produção conferidos por SELECT: UVA tem alunos no 6º (1) e 7º (25); SORRISO no 7º ao 10º; Integrado e UNIFIP do 1º ao 12º.

## 8. Adendo de 21/10/2026 — plano B por e-mail e ID do simulado nas Provas
Pedido do João: em semana de aplicação não dá para pedir as matrículas à IES e corrigir o cadastro a tempo, e nenhum aluno pode ficar sem cartão.
- **Regra:** matrícula utilizável (presente, no formato aceito, única na IES) segue como estava. **Sem matrícula utilizável** (vazia, formato fora, repetida) o aluno é identificado pelo **e-mail** no QR. O quadro MATRÍCULA continua no cartão, com a numeração em branco e a dica "escreva sua matrícula abaixo"; o e-mail aparece como rótulo sob o QR. Só fica de fora quem também não tem e-mail utilizável (vazio, inválido para o QR, com mais de 58 caracteres ou repetido).
- **QR:** `SFA2:E:<SIM8>:<EMAIL>` (minúsculas, byte, até 58 caracteres: versão 6). Para manter o módulo em 0,73 mm ou mais, a caixa do QR do `sfa` subiu de 30 para **36 mm** (x de 154 a 190, y de 20 a 56): template **`sfa_v4`** (o `sfa_v3.json` saiu). UniAtenas: template e PDF idênticos aos de antes.
- **Tela:** a lista mostra o selo "por e-mail" e o e-mail de quem cai no plano B; um aviso diz quantos são. O painel de excluídos agora é só de quem não tem nenhum dos dois, com o motivo dos dois. A busca acha por e-mail. CSV dos excluídos: `nome;matricula;email;semestre;motivo`. Lista da emissão: `identificacao;tipo;nome`.
- **Leitor e planilha:** `PageResult.identificacao` devolve matrícula ou e-mail; `processar` aceita a lista nova e a antiga (coluna `matricula`); a coluna 1 do xlsx passou a se chamar **`matricula_ra_ou_email`**; `Resumo` e `relatorio.json` contam as páginas identificadas por e-mail. Duplicidade vale para os dois tipos.
- **Importação (do João):** a 1ª coluna passa a ter matrícula **ou e-mail** na mesma planilha. Comparar `lower(trim(email))`; o script grava o e-mail em minúsculas. O cabeçalho da coluna 1 é só texto (a leitura é por posição), mas convém alinhar o modelo da tela com `matricula_ra_ou_email`.
- **Limitação conhecida:** o cartão UniAtenas (matrícula em bolhas) não tem plano B. Para os poucos alunos de campi UniAtenas sem matrícula, a tela permite escolher o modelo **Pessoal** para a IES e emitir o cartão por e-mail só para eles.
- **ID do simulado:** Simulados → Provas mostra o ID embaixo do nome (cinza claro, 11 px, selecionável com um clique): é o `--simulado` do `processar`.
- **Fixtures:** `sfa_*` regeneradas com cartões por e-mail e com o QR danificado mais forte (a caixa maior e o QR menos denso o recuperavam). Vetores de QR regenerados (inclui e-mails de 8 a 58 caracteres).
- **Não verificado:** impressão e escaneamento reais do QR da versão 6 (módulo de 0,73 mm); a tela com login real; quantos alunos de cada IES cairão no plano B (a consulta de 20/10 dá a ordem de grandeza: Famp, Fame, B2C, UEA, Claretiano, USCS, FAI e outras têm quase todos sem matrícula, então **o e-mail virou o caminho principal nelas**; falta saber a qualidade de `users.email`).

## 9. Aceite físico de 21/10/2026 (cartão com matrícula, UVA)
Primeiro teste com papel: o João imprimiu cartões de 5 alunos da UVA (1º Simulado), marcou à caneta (marcações corretas, em branco, dupla marcação, ✓, X e ponto), escaneou e rodou `cartao-omr processar`. Os dados dos alunos (nomes, matrículas, PDF e xlsx) ficam só em `runs/` e em Downloads; aqui só o resumo.
- **Resultado:** 5 páginas, 5 identificadas pela matrícula do QR, 0 ilegíveis, 0 em branco, 0 duplicadas, alinhamento de 0,09 a 0,32 mm. Das 500 questões: 216 marcadas, 265 em branco, 1 múltipla, 18 ambíguas. **Nenhuma letra errada.** O xlsx tem 101 colunas e a aba Respostas no formato da importação.
- **As 18 ambíguas são exatamente as marcações inválidas feitas de propósito** (✓, X e ponto, conferidas nos recortes): o leitor as deixa em branco, amarelas e com comentário, e a dupla marcação virou `multipla`. É o comportamento desenhado: nunca adivinha.
- **Margens dos limiares (dado real):** brancos pontuam até 0,16–0,19 (T_BAIXO = 0,20) e as marcas válidas a partir de 0,53–0,55 (T_ALTO = 0,50); as marcas inválidas ficaram entre 0,20 e 0,43. Os brancos têm pouca folga abaixo de T_BAIXO: em outro scanner ou papel alguns podem passar de 0,20 e virar `ambigua` (falha segura, mas mais revisão). Amostra de 500 questões não basta para mudar nada; a calibração fica para uma turma real (Fase 3).
- **Não coberto neste teste:** página duplicada (o `aluno_duplicado` só tem teste sintético), cartão do plano B por e-mail, cartão UniAtenas (matrícula em bolhas) e scan a 300 dpi.

## 10. Adendo de 21/10/2026 (tarde) — página repetida, pasta por execução, runbook e guia
- **Aceites do João:** o plano B por e-mail (aluno identificado, dry-run e `--lista` funcionando no app, já com a importação por e-mail na `main`) e o teste da página repetida em papel.
- **Página repetida (`processar`):** a mesma identificação em 2+ páginas com **respostas e dúvidas idênticas** mantém a primeira e vira aviso `pagina_repetida` nas demais (não vão para `Respostas`; o `Resumo` conta `repetidas_ignoradas`). Com respostas **diferentes**, todas viram `aluno_duplicado` em "Não identificados". Três páginas com uma diferente: todas para revisão.
- **Erro `Permission denied`:** era o `respostas_<simulado>.xlsx` da execução anterior aberto no Excel. O padrão agora é uma pasta por execução (`runs/<data>_<hora>_<simulado>/`) e o `PermissionError` vira mensagem clara (exit 2).
- **Runbook** (README do serviço, seção "Runbook: do cartão à importação") e **guia das IES** (`docs/prd/cartoes-resposta-guia-ies.md`, 1 página).
- **P2, P3, P5:** P2 (campi do UniAtenas) e P5 (avisar as IES) seguem abertas, e o guia ajuda na P5. **P3 mudou de natureza:** na consulta de 20/10 o UniAtenas tinha só 18 alunos sem matrícula (eram ~246 em 13/10) e o plano B por e-mail cobre quem não tem; deixou de bloquear.
- **Não coberto ainda:** o cartão UniAtenas em papel (matrícula em bolhas) e a calibração dos limiares (precisa de uma turma real).

## 11. Aceite físico do UniAtenas (29/10/2026)
- **Cartão preenchido certo:** lido, identificado pela matrícula em bolhas e aceito no dry-run da importação.
- **Casos de erro:** duas bolhas na mesma coluna e coluna em branco **não entraram** em `Respostas`; foram para `Pendências` (`matricula_invalida`) e `Não identificados`, com recorte em `recortes/` mostrando o problema. O `Resumo` ficou consistente.
- **QR:** o do UniAtenas (`SFA2:A:<SIM8>`) só escolhe o leitor e confere o simulado; rodar o mesmo PDF com outro `--simulado` fez todas as páginas virarem `simulado_divergente`, como esperado.
- **Pendências do projeto:** P2 **confirmada** pelo João (os 6 campi); P3 **dispensada** (o plano B por e-mail resolve; o cadastro é atualizado continuamente); P5 (avisar as IES) com o João. Falta só a calibração dos limiares, que depende de uma turma real.

## 12. Correção de 29/10/2026 — a tela agora lista todos os usuários da IES
Achado do João no teste da UVA: usuários com semestre em branco não apareciam para imprimir o cartão.
- **Causa:** não era o semestre. A tela omitia quem tem **qualquer papel** em `user_roles` (regra herdada da Fase E: "aluno = sem papel"), e os que sumiram eram **professores** (professor, gestor e admin não têm semestre, por isso a correlação). Consulta de leitura em produção: na UVA são 51 usuários, 26 sem papel (todos com semestre) e 25 com papel (22 professores, 3 gestores); nenhum aluno sem papel tem semestre em branco, nem nas demais IES consultadas. O papel `professor` é grande (830 usuários).
- **Correção:** `listarAlunosDaIes` devolve **todos** os usuários da IES, com `papeis`. A tela os mostra com o selo `equipe: professor` e **desmarcados por padrão** (o cartão de aluno não vai para quem não faz a prova sem querer); "Marcar todos" ou o clique marcam a equipe, e o filtro de semestre remarca só os alunos. Uma linha informa o total ("51 usuários na IES: 26 alunos e 25 da equipe"), que bate com a IES. Quem não tem matrícula nem e-mail continua no painel "fora do PDF", agora com o papel; o CSV ganhou a coluna `papel`.
- **Testes:** `api.test.ts` (novo: total = usuários da IES, com paginação de 1.000 e lotes de 150) e casos novos em `CartoesTab.test.tsx`; 290 verdes.
- **Observação:** `npx tsc`/`npm run dev` não achavam o `.bin` do `node_modules` compartilhado; usar `node node_modules/typescript/bin/tsc` e `node node_modules/vite/bin/vite.js`.
