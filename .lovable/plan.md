# Corrigir a leitura do drawer do aluno (Visão Geral → Alunos)

## O que eu verifiquei no banco (aluna BEATRIZ PATRIOTA SARAIVA COSTA, USCS, 11º)

| Fato | Valor real no banco |
|---|---|
| Simulados da IES no recorte | 3 (1º, 2º e 3º Simulado - USCS) |
| Participação | **2 de 3**: finalizou o 1º e o 3º; não fez o 2º |
| 1º Simulado | 76 acertos · nota TRI `score_proprio` = **80,3** (76/99 itens, 76,8%) → proficiente |
| 3º Simulado | 24 acertos em 100 · **sem linha de TRI** (resultado não processado) |
| % de acerto por grande área do 3º | Preventiva 0% · Saúde Mental 12,5% · Pediatria 22,2% · Clínica 26,3% · Cirurgia 26,3% · GO 27,8% · MFC 36,4% |

Conclusão: **nenhum número está errado.** A proficiência 80,3 é do **1º** simulado e as barras de área são do **3º** simulado — dois simulados diferentes na mesma tela, sem que isso fique claro. O que existe é um problema de leitura (e um contador errado), não de cálculo.

Dois defeitos reais encontrados:

1. **Contador "3 de 3 simulados"** — conta os simulados do recorte, não os que a aluna fez. Ela fez 2. Vale para todos os alunos: quem não participou de nada também aparece como "3 de 3".
2. **Seção "Desempenho por área" sem âncora visível** — ela pega automaticamente o simulado mais recente que tenha classificação por área, mesmo que esse simulado ainda esteja "Aguardando resultado". O subtítulo diz o nome do simulado, mas em letra pequena e sem sinalizar que aquele recorte é de um simulado **sem nota liberada**, enquanto o selo "Proficiente" no topo vem de outro simulado.

## O que vou mudar (só front-end, sem tocar em RPC/cálculo)

### 1. Contador de participação honesto
No cabeçalho do drawer, trocar "X de Y simulados" por participação real: contar apenas entradas com `participou = true`. Ex.: "11º período · participou de 2 de 3 simulados".

### 2. Deixar explícito de qual simulado é cada bloco
- Na seção "Desempenho por área", transformar o subtítulo num rótulo destacado com o nome e a data do simulado, mais uma tag de estado quando aquele simulado ainda não tem nota TRI ("resultado em processamento").
- Aviso curto e em linguagem simples quando o simulado das áreas **não** for o mesmo que originou a proficiência exibida no topo — algo como "As barras abaixo são do 3º Simulado (resultado ainda em processamento). A proficiência 80,3 é do 1º Simulado."

### 3. Escolher o simulado das áreas
Adicionar um seletor discreto (chips com os simulados em que o aluno participou) na seção de área, permitindo comparar o recorte de qualquer simulado. Padrão: o **mais recente com nota TRI liberada**; se nenhum tiver, cai no mais recente com dados de área, já com o aviso de processamento. Isso resolve o caso da aluna sem esconder nada — as barras passam a abrir no 1º simulado, coerentes com o 80,3.

### 4. Baseline de "área crítica"
Hoje a marcação de área crítica compara o aluno contra uma média da IES que soma todos os simulados juntos. Vou passar a comparar contra o mesmo simulado que está sendo exibido, para a marcação não ficar deslocada. (Se isso exigir mudança na RPC, deixo registrado e trago para sua aprovação em separado, sem alterar cálculo por conta própria.)

## Detalhes técnicos
- `src/features/gestor/components/DrawerAluno.tsx`: contador (`cobertos` → participação), estado local do simulado selecionado para as áreas, rótulo/tag/aviso, propagação do `simuladoId` escolhido para o drill-down por tema (`entradaAreaDetalhada`) e para `acertoOficialPorArea` — mantendo a regra de nunca fundir simulados.
- Nenhuma alteração em `get_gestor_aluno` / `get_gestor_aluno_desempenho_por_area` nesta etapa.
- Testes em `src/features/gestor/__tests__/DrawerAluno.test.tsx`: contador de participação, aviso de simulado divergente, troca de simulado nas áreas.
