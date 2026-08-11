# Corrigir abas ausentes no Portal do Gestor

## O que está acontecendo

As 5 abas do Painel de Desempenho (Visão Institucional, Diagnóstico Curricular, Visão de Alunos, Insights Pedagógicos, Inteligência Decisória) só aparecem quando a feature de cada módulo vem habilitada do servidor.

Verificado no banco agora:

- `ies_features` tem as 5 chaves de módulo habilitadas para todas as 24 IES (`gestao.visao_institucional`, `gestao.diagnostico_curricular`, `gestao.alunos`, `gestao.insights_pedagogicos`, `gestao.inteligencia_decisoria`).
- `feature_catalog` só tem 4 chaves: `gestao.enabled`, `gestao.exportar`, `gestao.ia`, `gestao.portal_v2`. As 5 chaves de módulo foram apagadas do catálogo numa limpeza anterior.
- A RPC `get_effective_features()` monta a resposta **a partir do catálogo** (`feature_catalog where active`). Chave que não está no catálogo simplesmente não volta — então o front recebe "false" para os 5 módulos e a barra de abas fica vazia. Isso vale também para admin (o caminho de bypass também lê o catálogo).

Ou seja: é dado faltando no catálogo, não bug de UI.

## Correção

Uma migration aditiva única, sem apagar nada:

1. Inserir de volta no `feature_catalog` as 5 chaves de módulo (experiência `gestao`, `active = true`, `is_master = false`, com rótulo/descrição e ordem de exibição na mesma sequência das abas), usando `ON CONFLICT (key) DO UPDATE` só para garantir `active = true`.
2. Garantia idempotente em `ies_features`: para as 24 IES, manter/inserir as 5 chaves como habilitadas (`ON CONFLICT DO NOTHING` — nenhum valor existente é sobrescrito para `false`).

Depois de aplicar:

- Consultar `feature_catalog` e conferir as 9 chaves `gestao.%`.
- Rodar a checagem por IES para confirmar que as 5 chaves seguem habilitadas nas 24 IES.
- Como o hook de features tem realtime em `ies_features` e cache por query, as abas voltam a aparecer no recarregamento da página (sem precisar relogar).

## Fora de escopo

Nenhuma alteração em código de front. `GestorLayout`/`GESTOR_NAV` já estão corretos — eles apenas refletem o que o servidor libera. O toggle `gestao.portal_v2` continua desligado em todas as IES (portal legado), como está hoje.
