## Diagnóstico

O problema atual não é mais o `get_institutional_performance`; pelos logs do preview, a tela cai para dados de demonstração porque a chamada `get_institutional_evolution` estoura timeout:

```text
Falha no carregamento, usando dados de demonstração: Evolution: canceling statement due to statement timeout
```

Como o hook trata qualquer falha de uma das consultas como falha geral, um erro apenas na evolução derruba a tela inteira e exibe os dados fake de 35% / Conceito 1.

## Plano de correção

1. **Blindar o carregamento principal**
   - Separar as consultas críticas dos dados acessórios.
   - Dados críticos: performance, student scores, TRI, total de alunos.
   - Dados acessórios: evolução e evolução TRI.
   - Se evolução falhar por timeout, a tela principal continuará com dados reais; apenas o gráfico de evolução ficará vazio ou usando fallback seguro.

2. **Remover fallback silencioso para Demo em falhas reais**
   - Manter dados Demo apenas quando não houver sessão/local preview sem autenticação.
   - Para erro de RPC com usuário autenticado, exibir erro real ou carregar parcial, mas nunca substituir por mock como se fosse dado real.
   - Isso evita o card “Demo” e os KPIs falsos quando uma RPC falha.

3. **Otimizar a RPC lenta `get_institutional_evolution`**
   - Criar migração para reescrever/ajustar a função `get_institutional_evolution` filtrando primeiro os simulados da IES e os alunos da IES, como foi feito nas RPCs principais.
   - Corrigir a evolução para respeitar a unificação pai/repescagens: ocultar filhos na lista, mas calcular dados usando o grupo do simulado pai quando aplicável.
   - Adicionar índices direcionados, se necessário, para `answer_progress`, `simulados_finalizados`, `questoes_simulado`, `users` e vínculo pai/IES em `simulados_admin`.

4. **Validar com os IDs do caso atual**
   - Testar a rota com `iesId=3e51663e-8766-4881-bfd1-0921678ed014` e `simuladoId=d3753831-4970-4714-8111-59be2359b88a`.
   - Confirmar que não aparece mais “Demo”.
   - Confirmar que os cards carregam com dados reais mesmo se a evolução estiver lenta/indisponível.

## Arquivos/áreas afetadas

- `src/hooks/useInstitutionalPerformanceData.ts`: tratamento de erro e carregamento parcial.
- `supabase/migrations/...sql`: otimização da `get_institutional_evolution` e índices necessários.
- Possivelmente `src/services/institutional.ts`: wrappers seguros para chamadas opcionais, sem derrubar a tela inteira.