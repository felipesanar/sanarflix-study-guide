# Remover o aviso "Recorte parcial" do Portal do Gestor

## Quando o aviso aparece hoje
A faixa amarela é desenhada por um único componente de bloco, sempre que o servidor marca o recorte como "parcial". Isso acontece quando:
- **Visão Geral:** algum simulado do período ainda não tem nota TRI (sem resultado processado).
- **Detalhamento por simulados:** algum simulado selecionado não tem TRI, ou algum aluno participou mas ficou sem proficiência calculada.
- **Detalhamento das questões:** alguma questão ficou sem nenhuma resposta (ex.: questão anulada).
- **Diagnóstico por área:** alguma resposta está em questão sem grande área cadastrada.

Como o mesmo aviso é repetido em cada bloco da tela (KPIs, Acerto por grande área, tabelas etc.), ele aparece várias vezes na mesma página, como no print.

## O que muda
- A faixa "Recorte parcial…" deixa de aparecer em todas as telas do gestor (Visão Geral e Detalhamento).
- Nada muda nos números nem no servidor: os cálculos continuam iguais. Os outros sinais honestos continuam: "—" quando falta dado, selo "cobertura parcial" nos cartões de amostra pequena, e o aviso de TRI em processamento.

## Detalhes técnicos
- `src/features/gestor/components/BlocoGestor.tsx`: remover a renderização da faixa `faixa-parcial` e a prop `parcial`.
- `routes/VisaoGeral.tsx` e `routes/Detalhamento.tsx`: remover `const parcial = meta.partial` e as props `parcial={parcial}` (3 + 5 usos).
- `__tests__/BlocoGestor.test.tsx`: substituir os testes da faixa por um que garante que ela não é renderizada; ajustar outros testes que procuram `faixa-parcial`.
- `meta.partial` segue no contrato da API (sem migração).
- Verificar com typecheck e os testes do gestor.
