# Drawer de detalhe do movimento (Leitura estratégica)

Cada cartão da Leitura estratégica passa a ser clicável e abre um drawer que responde três perguntas: **quem são os alunos**, **como executar** e **qual a melhora esperada** se o movimento for aplicado.

## Comportamento

- Os até 3 cartões da leitura ganham afordância de clique (hover, cursor, seta, foco visível, `Enter`/`Espaço`).
- Clique abre um drawer lateral (desktop) / folha de baixo para cima (mobile), no mesmo padrão dos drawers existentes do portal (`DrawerTemas`, `DrawerAluno`): título = ação do movimento, métrica em destaque, chip de prioridade e do recorte (IES + semestre + simulados).
- Conteúdo em quatro blocos:
  1. **O que está acontecendo** — releitura curta do número que sustenta o movimento, com o recorte explícito ("os alunos do 6º ano").
  2. **Quem é afetado** — lista real de alunos (nome, semestre, proficiência, variação entre simulados quando houver), com contagem e rótulo do critério usado. Alunos sem nota aparecem como "TRI em calibração", nunca como zero.
  3. **Como executar** — plano em passos numerados (o que fazer, com quem, em quanto tempo, como medir se funcionou).
  4. **Projeção** — cenário calculado do resultado: se N alunos do grupo cruzarem a faixa, a proporção de proficientes vai de X% para Y% (+Z p.p.), com o efeito no conceito ENAMED projetado quando os dados permitirem. Sempre rotulado como cenário, com a conta exibida.
- Estados completos: carregando (mesma narrativa em etapas da leitura), erro com "Tentar de novo", vazio ("sem alunos que atendam a esse critério neste recorte") e amostra baixa.
- Botão de recarregar dentro do drawer força leitura nova (ignora cache), igual ao da leitura.

## Cenários cobertos

O plano e a coorte se adaptam à natureza do movimento, que já vem do backend (`cobertura`, `calendario`, `engajamento`, `manejo_de_prova`), mais o alvo do texto:

- **Alunos na borda do corte** (50–59,9) — maior ganho por hora investida.
- **Alunos bem abaixo** (<50) — recuperação de base.
- **Alunos que variam entre simulados** — instabilidade de desempenho/manejo de prova.
- **Área ou tema frágil** — lista os alunos com pior acerto naquela área e o plano curricular.
- **Semestre que puxa o resultado para baixo** — coorte por semestre.
- **Cobertura de aplicação de simulados** — não há coorte de aluno: o bloco "Quem é afetado" vira "Alcance", com simulados aplicados vs. contratados e alunos sem participação.

## Regras respeitadas

- Nenhum número é inventado nem calculado pela IA: a lista de alunos e a projeção são derivadas dos dados que as RPCs `get_gestor_detalhamento` / `get_gestor_visao_geral` / `get_gestor_diagnostico` já devolvem. A IA escreve o texto e escolhe, de uma lista fechada, **qual critério de coorte** e **qual meta de movimento** se aplicam — os valores vêm do banco.
- Nome de aluno só aparece dentro do drawer (superfície de gestão), nunca no texto gerado pela IA.
- Sem dado → `—` / estado vazio. Nunca zero improvisado, nunca média de conceito ENAMED.
- Texto em pt-BR, linguagem simples, sem jargão, "a faculdade"/"a instituição" (nunca "o curso"), "6º ano" = 11º + 12º semestres.

## Detalhes técnicos

Frontend:
- `LeituraEstrategica.tsx`: itens viram `<button>` acessível; guarda o item selecionado e monta o drawer. Sem mudança na geração da leitura.
- Novo `src/features/gestor/components/DrawerMovimento.tsx`: `Sheet` do design system, container do portal via `useGestorPortalContainer`, foco devolvido com `useDevolverFocoAoFechar`, tokens `--gp-*` (nenhum hex solto), rolagem com barra oculta + fade de 16px como na leitura.
- Coorte e projeção calculadas em um módulo puro `src/features/gestor/lib/movimento.ts` (testável), consumindo os dados do recorte já em cache no React Query — sem chamada extra ao banco para a lista.

Backend (`supabase/functions/gestor-ai-insights/index.ts`, sem DDL e sem RPC nova):
- Novo modo `movimento`: recebe o item da leitura (título, métrica, texto, natureza), o escopo e o recorte; reusa as mesmas RPCs com o JWT do gestor.
- Tool schema novo com saída garantida: `criterio_coorte` (enum fechado), `diagnostico`, `passos[]` (ação, responsável, prazo, como medir), `meta_movimento` (quantos alunos do grupo devem cruzar a faixa), `risco`.
- Streaming SSE e cache em `ai_response_cache` no mesmo padrão do modo consultor, com chave incluindo o movimento e uma versão de prompt nova.

Testes: unidade do `lib/movimento.ts` (faixas, variação só com dois simulados, projeção em p.p., ausência de coorte) e integração do drawer (abertura por teclado, estados vazio/erro, ausência de `NaN`).

Nada fora disso muda: as demais telas, RPCs e o comportamento atual da leitura ficam intactos.
