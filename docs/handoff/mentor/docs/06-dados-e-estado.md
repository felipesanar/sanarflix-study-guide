# 06 · Dados, estado e eventos

Modelos sugeridos. Os nomes são indicativos; alinhe com o domínio existente do Gestor (`dw_*`, tipos em `src/features/gestor`).

## Entidades

```ts
type Modalidade = 'b2c' | 'b2b';

interface Mentor { id: string; nome: string; foto?: string; modalidade: Modalidade; triboId?: string; iesId?: string; turmaId: string; agendaUrl?: string }
interface Tribo { id: 'carcara'|'camaleao'|'colmeia'|'octopus'; nome: string; lema: string; cores: { sig: string; shadow: string; glow: string }; brasao: string; icone: string }
interface IES { id: string; nome: string; campus: string; tema?: { fundo: string; acento: string; acentoHover: string }; selo?: string; logo?: string; contrato: { encontrosPorMes: number; tiposSessao: TipoSessao[]; simuladosContratados: number } }
interface Turma { id: string; modalidade: Modalidade; alunoIds: string[] }   // B2B: recorte da IES (P9)

interface Simulado { id: number; nome: string; data: string | null; status: 'realizado'|'agendado'|'previsto'|'processando'; participantes?: number }
interface ResultadoAluno { alunoId: string; simuladoId: number; acertoPct: number | null; acertos?: number; proficiencia?: number | null }  // null = não fez
interface Aluno { id: string; nome: string; semestre: string; telefone: string; acessoAte: string; ultimaAtividade: string; meta?: { especialidade: string; instituicao: string; cortePct: number } }  // meta: B2C, depende de Metas

interface Questao { n: number; grandeArea: string; especialidade: string; tema: string; prevalencia: 'Alta'|'Média'|'Baixa'; enunciado: string; alternativas: { letra: string; texto: string; pct: number }[]; correta: string; alunosPorAlternativa: Record<string, string[]> }

type TipoSessao = 'encontro_tribo' | 'individual' | 'pos_simulado' | 'oficina';
interface Sessao { id: string; tipo: TipoSessao; data: string; hora: string; tema: string; alunoId?: string; link?: string; status: 'agendada'|'realizada'; gravacaoUrl?: string; pauta: ItemPauta[] }
interface ItemPauta { tipo: 'tema_critico'|'mais_erradas'|'livre'; referencia: string; texto: string }

interface Publicacao { id: string; tag: 'Desempenho'|'Aviso'|'Fique por dentro'; titulo: string; mensagem: string; link?: { url: string; titulo: string }; anexo?: string; destino: 'turma' | { alunoIds: string[] }; status: 'rascunho'|'publicada'; publicadaEm?: string }

type TipoIntervencao = 'individual' | 'coletiva' | 'mensagem';
interface Intervencao { id: string; tipo: TipoIntervencao; titulo: string; nota?: string; destino: { alunoIds?: string[]; grupo?: string; turmaToda?: boolean }; perfil?: 'virada'|'baixo'|'bom'; status: 'afazer'|'andamento'|'feito'; origem: OrigemIntervencao; criadaEm: string; historico: { em: string; texto: string }[] }
type OrigemIntervencao = 'manual' | 'agenda_liberada' | 'tema_critico' | 'questao' | 'mural' | 'sessao_criada';

interface AgendaLiberada { alunoId: string; desde: string; publicacaoId: string }
interface RotinaSemana { semana: string; itens: { dia: 'ter'|'qui'|'sex'; tipo: 'enquete'|'resposta'|'perola'; conteudo: string; enviadoEm?: string }[] }   // B2B
interface Sinalizacao { alunoId: string; motivo: string; em: string; comiteId?: string }   // B2B
```

## Eventos que criam ou movem intervenções

O kanban se preenche sozinho a partir das ações. **Implementar junto com cada tela.**

| Ação | Efeito |
|---|---|
| Publicar no mural com "Registrar como intervenção" | Cria `mensagem` em **Feito**, origem `mural` |
| Liberar agendamento individual (drawer B2C) | Publica a mensagem individual + cria `individual` em **A fazer**, origem `agenda_liberada` + entrada no log do aluno |
| Criar sessão | Cria card em **A fazer**, origem `sessao_criada` (individual → `individual`; coletiva → `coletiva`) |
| Marcar sessão como feita/realizada | Move o card ligado para **Feito** (ou cria em Feito) |
| "Intervenção" em tema crítico, questão ou tema do drawer de área | Cria `coletiva` em **A fazer**, origem `tema_critico` / `questao` |
| "Criar intervenção" no drawer do aluno | Cria `individual` em **A fazer**, com o perfil do aluno (B2B) |
| Abrir WhatsApp pelo Academy | Entrada no log do aluno (não cria card) |
| Mudar status no drawer do card | Entrada no histórico |

## Estado de UI por tela

| Tela | Estado local | Persistir na URL |
|---|---|---|
| Minha Turma | alerta ativo, segmento, busca, segmento da matriz, temas expandidos, aluno aberto | alerta, segmento, aluno |
| Visão Geral (B2B) | período, perfil, grupo, busca, área/ordenação/limite dos temas, tema aberto | período, perfil, grupo |
| Detalhamento | simulados selecionados, simulado da lista de questões, aba da visão de alunos, busca, área, ordenação, questão aberta, área do drawer | simulados (`?s=4,5`), ordenação, área |
| Mural | rascunho (persistir no servidor via "Salvar rascunho"), erros de validação | — |
| Sessões | filtros, sessão expandida, formulário | sessão aberta |
| Intervenções | período, tipo/perfil, card aberto | card aberto |

Deep links necessários: Início → Turma/Visão Geral filtrada; drawer do aluno → Detalhamento com um simulado; Visão Geral → Detalhamento do último simulado do período; questão → Mural com destinatários; Diagnóstico → Mural com texto.

## Endpoints / consultas necessárias

| Dado | Existe no Gestor? |
|---|---|
| Cronograma de simulados com status | Sim (usado pelo `SeletorSimulados`) |
| Resultados por aluno × simulado (acerto, proficiência) | Sim |
| Conceito previsto e % de proficientes por simulado | Sim (`get_gestor_visao_geral`) |
| Acerto por grande área × prevalência; especialidade; tema | Parcial (há área × semestre; falta o eixo prevalência) |
| Questões com distribuição por alternativa e alunos por alternativa | Parcial (falta a lista de alunos por alternativa) |
| Insights de IA | Sim (`BlocoInsights`); falta "gerar de novo" |
| Última atividade de estudo por aluno | **Não**: depende de P1 |
| Questões resolvidas por semana por aluno | **Não** |
| Metas do aluno (especialidade, instituição, corte) | **Não**: V1, previsto para novembro |
| Mural, sessões, intervenções, agenda liberada, rotina, sinalizações, banco de pérolas | **Não**: novos |
