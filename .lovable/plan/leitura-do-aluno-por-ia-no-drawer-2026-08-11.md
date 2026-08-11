# Leitura do aluno por IA no drawer

Trocar o bloco fixo "Destaque do aluno / Grande área crítica" (hoje calculado só pela maior e menor grande área) por uma leitura curta gerada por IA, com **um ponto positivo** e **um ponto de atenção**, sempre coerente com o que está na tela naquele momento.

## Como fica na tela

No lugar do bloco verde/vermelho atual, um cartão com duas linhas:

```text
LEITURA DO ALUNO (IA)
[+] Ponto forte    Pediatria sustenta 89% de acerto nos dois simulados...
[!] Ponto de atenção   Clínica Médica caiu de 84% para 81% e é a área que...
```

- Gera sozinho ao abrir o drawer (sem clique), com skeleton de duas linhas no lugar exato do texto final.
- Erro ou resposta vazia: cai para o bloco atual (maior/menor área) — nunca fica vazio nem quebra o drawer.
- Regenera quando o gestor troca a visão do bloco de áreas (consolidado "Todos" vs. um simulado específico).
- Sem número inventado: a IA só pode citar valores presentes no contexto enviado.

## Contexto da página que vai para a IA

- Aluno, semestre, IES e o recorte de simulados selecionado na página.
- Visão ativa do bloco de áreas: consolidada (média ponderada de todas as tentativas) ou um simulado.
- Proficiência/situação por simulado, variação, e o % de acerto por grande área / especialidade / tema da visão ativa.
- Avisos de amostra baixa e de resultado pendente, quando existirem.

## Detalhes técnicos

**Edge function `gestor-ai-priorities`/`gestor-ai-insights`** — evoluir o `modo: "aluno"` que já existe:
- Aceitar no body `visao: "consolidado" | <simuladoId>` e incluir na chave de cache (`hashChave`), para consolidado e por simulado terem entradas próprias.
- Modelo: `AI_MODEL_RAPIDO` (`google/gemini-3.6-flash`), como pedido.
- Saída estruturada via tool `leitura_aluno` com dois campos obrigatórios (`pontoForte`, `pontoAtencao`), cada um com `titulo` curto e `texto` de 1–2 frases, em vez do parágrafo livre de hoje — assim a UI não precisa fatiar texto.
- `SYSTEM_PROMPT_ALUNO` reescrito para: exatamente um ponto positivo e um ponto de atenção, linguagem simples (mesma doutrina de linguagem já usada no modo consultor), sem linguagem dirigida ao aluno, sem jargão, respeitando o recorte e a visão informados.
- `buildAlunoPrompt` passa a descrever a visão ativa (consolidada ou simulado X) e o detalhe por especialidade/tema dessa visão.
- Cache em `ai_response_cache` mantido com o TTL atual; resposta antiga em texto puro continua sendo aceita por compatibilidade.

**Front (`src/features/gestor/components/DrawerAluno.tsx`)**:
- Novo componente local `LeituraAlunoIA` no lugar da chamada a `InsightArea`, recebendo `iesId`, `alunoId`, `simulados`, `visao` e as áreas da visão ativa.
- Busca via `useQuery` (chave incluindo a visão) chamando `supabase.functions.invoke('gestor-ai-insights')`, com `staleTime` alto para não repetir chamada ao reabrir o drawer.
- `InsightArea` é mantido como fallback do estado de erro.
- Estilo com tokens `--gp-*` existentes (success-surface para o ponto forte, warning-surface para o ponto de atenção), sem hex solto.
- Testes: atualizar `src/features/gestor/__tests__/DrawerAluno.test.tsx` para cobrir loading, sucesso (dois pontos renderizados) e fallback no erro.
