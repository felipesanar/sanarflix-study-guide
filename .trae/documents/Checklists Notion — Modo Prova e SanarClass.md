# Modo Prova

## Objetivo
- Entregar experiência de prova em tela cheia, focada e fluida, com navegação eficiente e persistência confiável do progresso.

## Tipo
- [ ] Feature
- [ ] Bug fix
- [ ] Melhoria
- [ ] Refatoração

## Descrição
- Navegação lateral sem scroll, ordem horizontal e largura dinâmica.
- Área de enunciado/alternativas ampliada; grid responsivo com separação/alinhamento.
- Acessibilidade nas interações (botões, foco, aria‑pressed) e restauração de alternativa eliminada.
- Persistência do estado (respostas, marcações, posição) e barra de progresso.
- Proteções de rota, tela cheia e cronômetro com pausa/retomada em eventos críticos.

## Entregáveis
- [x] Navegação lateral horizontal sem scroll e itens compactos
- [x] Ocultação de sidebar/cabeçalho no modo prova (full‑screen)
- [x] Grid responsivo das alternativas com separação/alinhamento
- [x] Acessibilidade das alternativas (button, foco, aria‑pressed)
- [x] Recuperação de alternativa eliminada por clique/ícone
- [x] Persistência de respostas/estado e barra de progresso
- [x] Navegação anterior/próxima e salto direto para questão
- [x] Fluxo de finalização com envio e proteção de rota

## Backlog (Planejado)
- [ ] Atalhos de teclado: 1–4 para alternativas; setas para navegação
- [ ] Filtro na navegação: visualizar apenas “marcadas para revisão”
- [ ] Confirmação ao sair do modo tela cheia durante a prova
- [ ] Feedback visual dedicado para eliminar/restaurar alternativa
- [ ] Auto‑save com debounce para reduzir I/O de storage
- [ ] Indicador de progresso por tema/seção (se metadados disponíveis)
- [ ] Modo alto contraste específico do modo prova

## Observações
- KPIs: tempo médio por questão, taxa de conclusão, saídas de aba, erros por questão.
- Acessibilidade e atalhos não devem conflitar com foco de elementos.
- Metadados por tema/seção podem exigir evolução da fonte de dados.

# SanarClass

## Objetivo
- Oferecer acesso organizado às aulas da IES, com busca, filtros e visualização de conteúdos, integrando progresso e UX consistente com o guia de estudos.

## Tipo
- [ ] Feature
- [ ] Bug fix
- [ ] Melhoria
- [ ] Refatoração

## Descrição
- Listagem de aulas por disciplina/tema com filtros e busca.
- Visualização de conteúdos (vídeo, links, materiais) em layout responsivo.
- Integração com autenticação e regras de acesso do usuário.
- Caching e pré‑carregamento suave para melhorar tempos de carregamento.
- Padronização de UI/tema com componentes comuns.

## Entregáveis
- [x] Página SanarClass com listagem de aulas e filtros básicos
- [x] Integração com autenticação e controle de acesso
- [x] Visualização de materiais da aula (links, PDFs, vídeos)
- [x] Layout responsivo consistente com a identidade da plataforma

## Backlog (Planejado)
- [ ] Busca por texto com realce de termos
- [ ] Filtros avançados (semana/tema/professor) e ordenação
- [ ] Indicador de progresso por aula (assistido/em andamento)
- [ ] Favoritos/Playlist de estudo e histórico de visualização
- [ ] Modo offline básico (cache de metadados e capas)
- [ ] Telemetria de engajamento (tempo assistido, cliques, abandono)
- [ ] Melhorias de acessibilidade (atalhos de navegação, foco)

## Observações
- Integrar com regras de acesso (perfis B2B/B2C, períodos/semestres).
- Garantir performance em listas extensas (virtualização se necessário).
- Usar feature flags para releases graduais onde fizer sentido.