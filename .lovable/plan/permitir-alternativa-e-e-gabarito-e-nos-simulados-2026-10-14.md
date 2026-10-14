# Permitir alternativa E e gabarito E nos simulados

O banco já aceita a letra E (coluna `alternativa_e` existe e o gabarito aceita A–E). O bloqueio está no formulário "Novo simulado" e em algumas telas que só mostram A–D.

## O que muda

1. **Novo simulado (planilha de questões)**
   - Passa a ler a coluna "Alternativa E" (opcional). Questões sem E continuam com 4 alternativas.
   - Gabarito aceita A, B, C, D ou E. Mensagem de erro passa a dizer "Deve ser A, B, C, D ou E".
   - Se o gabarito for E e a questão não tiver "Alternativa E" preenchida, a planilha é recusada com aviso da linha.
   - Arquivo modelo ganha a coluna "Alternativa E"; texto de ajuda muda para "Alternativa A–E (E opcional)".

2. **Telas que hoje só mostram A–D** (senão o aluno não conseguiria marcar E)
   - Prova do aluno (Modo Prova): mostra a opção E quando a questão tiver.
   - Revisão da prova oficial: mostra E quando existir.
   - Correção/desempenho e "Ver questões" do admin já leem E; serão conferidos.

3. **Importar respostas**: o modelo de exemplo passa a sortear também E (a leitura das respostas já aceita E).

## Detalhes técnicos
- `SimuladoConfigDialog.tsx`: validação `['A'..'E']`, `alternativa_e` de `normalizedRow['alternativa e']` (null se vazio), tipo `correta`, template e ajuda.
- `ModoProva.tsx` (linha ~778) e `features/prova-oficial/components/QuestaoRevisao.tsx`: lista de letras inclui E filtrando por alternativa preenchida; `types/simulado.ts` (`Questao`, `RespostaSimulado`) ganha E; `simuladosApi.ts` passa a trazer `alternativa_e`.
- `ImportarRespostasTab.tsx`: amostra A–E.
- Atualizar/rodar `SimuladoConfigDialog.test.tsx` com caso de gabarito E.
- Sem mudança no banco.
