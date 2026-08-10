# Evolução das 3 features de IA: streaming, schema garantido, cache no servidor e inteligência de análise

Fecha os 4 pontos de atenção do resumo técnico e sobe o nível das três IAs (Leitura estratégica do gestor, Tutor do aluno, Caderno de Erros): mais dados cruzados, modelo melhor por tarefa e system prompts construídos a partir da regra real do ENAMED.

## 1. Streaming em todas as chamadas

Hoje as três funções fazem chamada bufferizada (`response.json()`), o que expõe o `mode: 'full'` (2000 tokens) ao corte de ~2 min do host — e o corte é cobrado igual.

- Todas as chamadas ao gateway passam a usar `stream: true` e leitura SSE.
- Onde a UI se beneficia de texto progressivo (Leitura estratégica, plano do tutor, análise do Caderno de Erros), a resposta da edge function também é repassada como stream para o front, e o componente renderiza o conteúdo chegando.
- Onde o front só quer o resultado final, o stream é consumido dentro da própria function e devolvido inteiro — mas com bytes fluindo, sem risco de corte.
- Nenhum `AbortSignal.timeout` / timer: cancelamento só por ação do usuário (sair da tela / trocar de recorte), que aborta a requisição em curso.
- A "Leitura estratégica" ganha comportamento real de streaming: as etapas atuais continuam enquanto nada chegou, e o texto passa a aparecer conforme é gerado.

## 2. JSON garantido por schema (fim do parse defensivo)

- Modo `consultor`: sai a instrução no prompt e entra saída estruturada garantida (tool/function calling com schema estrito, como já é feito no `ai-study-recommendation`), com campos obrigatórios, no máximo 3 itens e `prioridade` como enum.
- `analyze-error-patterns` também passa a devolver estrutura (clusters, fragilidades, plano priorizado) em vez de prosa solta, o que permite renderizar o insight como dashboard em vez de bloco de texto.
- O parse defensivo do front continua como rede de segurança, mas deixa de ser o mecanismo principal.

## 3. Cache e deduplicação no servidor

Hoje o cache é só `sessionStorage`: F5, outra aba, outro dispositivo ou outro gestor da mesma IES re-cobram a chamada.

- Nova tabela de cache no banco (chave = função + modo + hash do recorte/usuário, valor = payload gerado, `expires_at`), escrita e leitura pela própria edge function com service role, RLS fechada para o cliente.
- TTLs por natureza do dado: leitura do gestor (recorte de IES/semestre/simulados) com TTL mais longo, pois o dado só muda quando entra simulado novo; tutor do aluno e Caderno de Erros com TTL curto.
- Deduplicação: chamadas concorrentes para a mesma chave aguardam/reaproveitam o resultado em vez de disparar duas gerações.
- Um cache compartilhado por IES significa que o segundo gestor que abre a mesma tela não gasta crédito nenhum.
- O botão de refresh da Leitura estratégica passa a forçar bypass do cache.

## 4. `notify-feedback-slack`

Confirmado: é só webhook, não usa IA. Fica documentado no cabeçalho do arquivo para não aparecer como integração de IA em auditorias futuras. Nenhuma mudança de comportamento.

## 5. Mais dados e mais cruzamento

**Leitura estratégica (gestor)** — hoje lê só `get_gestor_detalhamento`. Passa a cruzar, no mesmo recorte: visão geral (conceito ENAMED projetado, proficientes, deltas), diagnóstico curricular por grande área e por nível, proficiência por semestre, comparativo entre simulados (evolução entre aplicações), distribuição de alunos por faixa e concentração de questões com pior acerto. Isso permite afirmações do tipo "a área X caiu N p.p. entre o simulado A e o B e concentra Y% dos alunos abaixo da faixa".

**Tutor do aluno** — hoje usa progresso, provas futuras e agregados de simulado. Ganha: histórico de proficiência por simulado (tendência, não só foto), acerto por grande área e subespecialidade cruzado com o que já foi concluído no Guia (lacuna real vs. conteúdo nunca estudado), entradas do Caderno de Erros e cadência de estudo recente.

**Caderno de Erros** — hoje a função não lê o banco, só recebe entradas do front. Passa a ler o histórico do aluno no servidor e cruzar o motivo declarado do erro com o desempenho real por área/subespecialidade nos simulados, separando erro de conteúdo, erro de interpretação e erro de manejo de prova.

## 6. Modelos por tarefa

- Leitura estratégica (gestor, raciocínio sobre muitos números, poucas chamadas, cache compartilhado): modelo de raciocínio mais forte — `google/gemini-3.1-pro-preview`.
- Plano completo do tutor: `google/gemini-3.6-flash` (atual padrão, substitui o `gemini-3-flash-preview`).
- Recomendação curta do aluno e análise do Caderno de Erros: `google/gemini-3.6-flash`.
- O modelo fica em constante único por função, fácil de trocar.

## 7. System prompts reconstruídos

Base factual que entra nos prompts (pesquisa em fontes oficiais):

- ENAMED substitui o antigo exame de avaliação da formação médica e acumula três funções: avaliação do estudante, insumo de avaliação do curso (SINAES) e porta de entrada de residência via ENARE.
- Matriz de Referência Comum para a Avaliação da Formação Médica (Portaria INEP nº 478/2025) — as grandes áreas cobradas e o peso relativo de cada uma.
- Nota do participante por Teoria de Resposta ao Item (Nota Técnica INEP nº 42/2025): acerto bruto não é nota; item discriminativo pesa mais, e acerto em item fácil errado por muitos vale pouco. Consequência estratégica: subir a base (áreas de alto volume e alta discriminação) move mais a nota do que caçar tópico raro.
- Padrões de desempenho por Angoff Modificado combinado com TRI (Nota Técnica INEP nº 19/2025) — existe ponto de corte esperado, então a leitura precisa falar de "quantos alunos cruzam a faixa", não só de média.

Prompt do consultor (gestor) passa a operar como consultoria pedagógica sênior de verdade: diagnóstico → causa provável → movimento com dono, prazo e métrica de verificação, sempre priorizado por impacto na nota TRI da instituição, e distinguindo problema de cobertura curricular, de calendário e de engajamento. Continua proibido de inventar número, de criar fórmula e de citar aluno nominalmente.

Prompt do tutor do aluno passa a raciocinar por retorno sobre esforço até a próxima prova (impacto na nota × tempo disponível), com métodos de estudo explicitados por situação. Segue proibido de dar conduta clínica.

Prompt do Caderno de Erros passa a classificar erro por natureza e devolver plano de revisão espaçada com verificação.

## Detalhes técnicos

- `supabase/functions/gestor-ai-insights/index.ts`: SSE, tool schema estrito no modo consultor, novas RPCs no pacote de contexto do modo consultor, cache/dedup, novo modelo.
- `supabase/functions/ai-study-recommendation/index.ts`: SSE nos dois modos, contexto ampliado no `aggregateSnapshot`, cache, modelo atualizado.
- `supabase/functions/analyze-error-patterns/index.ts`: SSE, leitura de dados no servidor, saída estruturada, cache.
- `supabase/functions/notify-feedback-slack/index.ts`: só comentário de cabeçalho.
- Migration aditiva: tabela de cache de IA com `expires_at`, índice pela chave, GRANTs só para `service_role`, RLS habilitada sem policy para cliente. Nenhum DELETE/TRUNCATE de dado existente; a limpeza é por expiração.
- Front: `LeituraEstrategica.tsx` (consumo em stream + refresh com bypass), `AiTutorCard.tsx`, `AiRecommendationCard.tsx`, `AIInsightsCard.tsx` (stream e, no Caderno de Erros, render da estrutura nova). Nada de número calculado no front.
- Verificação: chamada real em cada uma das três funções após o deploy, lendo a resposta, mais checagem de cache hit na segunda chamada.
