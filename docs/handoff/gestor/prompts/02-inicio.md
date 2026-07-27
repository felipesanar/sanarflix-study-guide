# Fase 2 — Início do Gestor (`/gestor`)

Implemente a home. **Nenhum indicador de desempenho aqui** (sem KPI, sem gráfico).

**Layout:** saudação + contexto da IES → dois cards direcionadores (Visão Geral, Detalhamento) → grade `2fr/1fr` com Cronograma | Avisos.

**Cronograma de Simulados (âncora):**
- Linhas com data, nome e status: `realizado · agendado · reagendado · previsto · em processamento`.
- Próximo simulado em destaque (borda de marca).
- Simulado realizado leva ao Detalhamento **já filtrado** por aquele simulado.
- Bloco "contratados sem data" com ações *Agendar* e *Falar com consultor*.
- Rodapé com a proveniência do contrato.
- O mesmo componente será reaproveitado como **drawer** na fase 6 — projete-o para os dois usos.

**Avisos da Sanar:** não-lido com ponto de marca + fundo destacado; abrir marca como lido (mutação otimista com rollback); máximo 3 + "Ver todos".

**Direcionadores:** hover sobe 1px + borda de marca; `prefetchQuery` da rota de destino no hover.

**Estados:** loading (skeleton das duas colunas), vazio ("nenhum simulado contratado"), erro com retry.

**Aceite:** teclado completo, `axe` limpo, claro e escuro revisados, testes de integração com MSW.
