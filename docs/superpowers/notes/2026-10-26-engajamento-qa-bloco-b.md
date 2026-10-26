# QA do Bloco B (Engajamento SanarFlix), 26/10/2026

Conferência da B16: cada número visível na tela contra a consulta na fonte, na PARACATU (`d86c32ba-2d09-4c7e-a426-1d981ec7b595`), "Últimos 6 meses" (01/05 a 26/10/2026), logo depois do refresh das 06:02 BRT. Critério da spec: **tela = RPC = fonte** (§14). A tela só lê a RPC, então a coluna "tela" foi lida no DOM e a "fonte" vem de SQL de leitura contra `eng_*` e as fatos.

## Tela × fonte

| Aba / bloco | Número | Tela | Fonte |
|---|---|---|---|
| Visão geral › KPIs | Base ativa (V1) | 521 | 521 |
| | Engajados (V2) | 331 (64%) | 331 |
| | Sem retorno 30+ dias | 141 (27%) | 141 |
| | Questões / acerto (V5, V6) | 146.583 / 66% | 146.583 / 66,4% (camada); ver nota 1 |
| | Questões por engajado | 443 | 146.583 ÷ 331 = 442,8 |
| Mês a mês | Mai a Out | 202, 223, 206, 222, 223, 170 | 202, 223, 206, 222, 223, 170 |
| Hábito (V10) | baixo / médio / alto / altíssimo | 133, 50, 35, 5 (= 223) | 133, 50, 35, 5 |
| Nível (V9) | frequente / esporádico / parou / nunca | 3, 187, 15, 316 | 3, 187, 15, 316 |
| Recência (V8) | ativos30 / 30–59 / 60+ / nunca | 190, 70, 71, 190 | 190, 70, 71, 190 |
| Consumo | Vídeos / documentos (V7) | 8.848 / 5.043 | 8.848 / 5.043 (camada); ver nota 1 |
| | Alunos que resolveram / assistiram / leram | 296 / 209 / 284 | 296 / 209 / 284 |
| Tabela Por aluno (V19) | Total de alunos; aluno de maior volume | 521; 5.840 q, 22 v, 106 d | 521; 5.840, 22, 106 |
| Comparativo | 8º: base, engajados, vídeos/aluno, questões/aluno, acerto | 170, 65%, 10,5, 184, 67% | 170, 111 (65,3%), 10,5, 184, 66,9% |
| | 12º | 180, 62%, 39,1, 811, 68% | 180, 111 (61,7%), 39,1, 811, 67,7% |
| Drawer (Iohany) | Questões, acerto, vídeos · docs, dias ativos | 5.840, 76%, 22 · 106, 82 de 179 | 5.840, 75,6%, 22 · 106, 82 |
| | Questões por mês e top 5 de especialidades | 414/1.172/1.286/2.062/680/226; Obstetrícia 79% (635)… | idênticos |
| Questões (V11) | Total, ciclos, 5 grandes áreas | 146.583; 145.283 + 1.300; 45.453/34.075/28.125/22.511/15.119 | idênticos |
| | Tema de maior volume (pop-up) | HPV e Câncer de Colo Uterino: 4.310 q, 184 alunos | idêntico |
| Conteúdos (V14) | Consumos, vídeos, alunos que consumiram | 13.891, 8.848, 301 | 13.891, 8.848, 301 |
| | Obstetrícia / Ginecologia / Cirurgia Geral | 1.395 (140) / 1.272 (151) / 953 (109) | idênticos |
| | Pop-up de um conteúdo | 30 consumos, 26 alunos, há 103 e 56 dias | idêntico |
| Conteúdos `tipo=video` | Consumos, alunos, Obstetrícia | 8.848, 209, 1.028 (86) | idênticos |
| Últimos 30 dias | Engajados, sem retorno, vídeos, docs, alunos | 190, 141, 733, 536, 70 | idênticos |
| | Comparativo vs. 30 dias anteriores | ▼ 6 p.p. (engaj.), ▼ 3 p.p. (acerto), −32% vídeos, −43% docs | 42,2% → 36,5%; 67,6% → 64,2%; 1.082 → 733; 942 → 536 |
| Aluno filtrado | Semestre, turma, situação, acerto, hábito | 12º, 180, ativo há 14 dias, 76%, 12 dias em set | idênticos |
| Admin › KPIs (V17) | Base, IES, engajados, sem retorno, questões, mediana | 7.122, 21, 56%, 1.949, 942 mil, 64% | 7.122, 21, 55,8%, 1.949, 942.258, 63,5% |
| Admin › ranking | Soma das bases; 3 primeiras IES | 7.122; Fatec 124/96%, FAI 102/87%, VALENÇA 170/80% | idênticos |
| | PARACATU (V16) | 521, 64%, acerto 66%, proficiência 75% (UNIATENAS 10/09/26) | gestor igual; 338 ÷ 452 = 74,8% |
| | IES sem simulado ENAMED | 6 | 6 |
| CSV de Questões | Soma dos nós de nível 1 | 146.583 | 146.583 |

**Nota 1.** Entre o refresh (06:00 BRT) e a consulta de validação, a carga externa trouxe 42 respostas e 29 eventos de consumo da PARACATU (`carregado_em` posterior ao refresh). Por isso a consulta direta nas fatos dá 146.625 questões e 8.849 / 5.044 consumos, e a camada `eng_*` (que a RPC lê) dá 146.583 e 8.848 / 5.043. Não é divergência da RPC: a camada bate exatamente com a fonte até o instante do refresh (conferido para os 42 registros de questões, todos posteriores ao refresh). Some no refresh das 06:00 de amanhã.

**Nota 2.** O contador animado do `KpiCard` (count-up) não anda numa aba em segundo plano (o navegador congela `requestAnimationFrame`); nas leituras automatizadas ele aparece como "0" até a aba ser desenhada. Com a aba visível o valor final aparece (verificado).

## Estados, tema e layout

- Tema claro e escuro conferidos (gestor); mês a mês em claro lido por screenshot.
- Mobile (375 px): nenhuma das 3 abas do gestor e o admin geram rolagem horizontal da página; as tabelas largas rolam dentro do próprio contêiner. Foram precisos `min-w-0` nos blocos em grade e, no admin, `w-0 min-w-full` na raiz da página (o `SidebarInset` do console cresce com o conteúdo) e `relative` no contêiner da tabela (o `th` `sr-only` absoluto escapava do recorte e alargava a página).
- Acessibilidade: axe sem violações nas 3 abas (e com cada pop-up aberto) e no drawer; ESC devolve o foco ao disparador; todo gráfico está numa `figure` com `role="img"` nomeado e "Ver dados em tabela".

## Testes

Suíte inteira em 26/10/2026: 160 arquivos, 2.314 testes, **40 falhas, exatamente as do baseline** (`2026-10-22-engajamento-baseline-testes.md`): nenhuma nova, nenhuma a menos. Type-check limpo.

Testes existentes alterados fora da lista da §15.3 (todos enumeravam rotas ou itens de navegação, e a spec exige as rotas novas): `src/test/unit/buildAppRoutes.test.ts` (gestor 3 → 4 telas novas; admin 12 → 13 seções) e `src/features/gestor/__tests__/a11y.test.tsx` (só acréscimos).
