/**
 * Coorte e projeção de um MOVIMENTO da Leitura estratégica.
 *
 * Este módulo é puro e determinístico de propósito: a IA escreve o texto do
 * plano e escolhe, de uma lista FECHADA, qual critério de coorte se aplica —
 * mas quem é o aluno e quanto muda o indicador sai daqui, a partir do dado que
 * as RPCs já devolveram. Nenhum número da tela é inventado pelo modelo
 * (regra 2 do handoff: "nunca invente número").
 *
 * Faixas (escala fixa de proficiência 0–100, corte em 60 — spec §4.1):
 *   - `borda_do_corte`: 50 ≤ p < 60 — maior ganho por hora investida;
 *   - `abaixo_da_base`: p < 50 — recuperação de base;
 *   - `acima_da_faixa`: p ≥ 60 — quem já cruzou;
 *   - `em_variacao`: dois ou mais resultados e oscilação relevante entre eles;
 *   - `sem_nota`: participou e ainda não tem TRI ("TRI em calibração");
 *   - `por_semestre`: recorte de semestre puxando o resultado para baixo;
 *   - `sem_coorte`: movimento de cobertura/calendário — não há lista de aluno.
 */

import type { LinhaAluno } from '@/features/gestor/api/types';

export type CriterioCoorte =
  | 'borda_do_corte'
  | 'abaixo_da_base'
  | 'em_variacao'
  | 'acima_da_faixa'
  | 'sem_nota'
  | 'por_semestre'
  | 'sem_coorte';

export const CORTE_PROFICIENCIA = 60;
export const PISO_BASE = 50;
/** Oscilação, em pontos, a partir da qual o aluno é considerado instável. */
export const LIMIAR_VARIACAO = 5;

export interface AlunoDaCoorte {
  id: string;
  nome: string;
  semestre: number | null;
  /** Último resultado conhecido; `null` = TRI em calibração. */
  proficiencia: number | null;
  /** Só existe com DOIS ou mais resultados conhecidos (regra 3 do handoff). */
  variacao: number | null;
  /** Quantos resultados com nota o aluno tem na janela. */
  resultados: number;
}

export interface DescritorCriterio {
  rotulo: string;
  explicacao: string;
}

export const DESCRITORES: Record<CriterioCoorte, DescritorCriterio> = {
  borda_do_corte: {
    rotulo: 'Alunos na borda do corte',
    explicacao: `Nota entre ${PISO_BASE} e ${CORTE_PROFICIENCIA - 1},9: estão perto de cruzar a faixa de proficiência (o corte de ${CORTE_PROFICIENCIA} pontos).`,
  },
  abaixo_da_base: {
    rotulo: 'Alunos bem abaixo do corte',
    explicacao: `Nota abaixo de ${PISO_BASE}: a distância até o corte é grande, então o trabalho é de base, não de ajuste fino.`,
  },
  em_variacao: {
    rotulo: 'Alunos que variam entre os testes',
    explicacao: `Diferença de ${LIMIAR_VARIACAO} pontos ou mais entre o primeiro e o último resultado. Só entra quem fez dois ou mais testes.`,
  },
  acima_da_faixa: {
    rotulo: 'Alunos acima da faixa',
    explicacao: `Nota igual ou maior que ${CORTE_PROFICIENCIA}: já cruzam a faixa e sustentam o resultado da instituição.`,
  },
  sem_nota: {
    rotulo: 'Alunos sem nota ainda',
    explicacao: 'Fizeram o teste, mas a nota TRI ainda está sendo calculada. Aparecem como TRI em calibração.',
  },
  por_semestre: {
    rotulo: 'Alunos do semestre em foco',
    explicacao: 'Todos os alunos do semestre que puxa o resultado para baixo neste recorte.',
  },
  sem_coorte: {
    rotulo: 'Sem lista de alunos',
    explicacao: 'Este movimento é de cobertura e calendário: o alvo é a aplicação de simulados, não um grupo de alunos.',
  },
};

/** Resultados conhecidos do aluno, em ordem cronológica (a RPC já ordena). */
function valores(aluno: LinhaAluno): number[] {
  return (aluno.proficiencias ?? [])
    .map((p) => p.valor)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
}

export function normalizarAluno(aluno: LinhaAluno): AlunoDaCoorte {
  const notas = valores(aluno);
  const ultima = notas.length ? notas[notas.length - 1] : null;
  const variacao = notas.length >= 2 ? Number((notas[notas.length - 1] - notas[0]).toFixed(1)) : null;
  return {
    id: aluno.id,
    nome: aluno.nome,
    semestre: aluno.semestre,
    proficiencia: ultima,
    variacao,
    resultados: notas.length,
  };
}

export interface OpcoesCoorte {
  /** Só usado por `por_semestre`. */
  semestreAlvo?: number | null;
}

/**
 * Aplica o critério sobre a lista completa de alunos do recorte. Ordena pelo
 * que importa em cada caso (quem está mais perto do corte primeiro, quem varia
 * mais primeiro) — a ordem é parte da leitura, não decoração.
 */
export function selecionarCoorte(
  alunos: LinhaAluno[],
  criterio: CriterioCoorte,
  opcoes: OpcoesCoorte = {},
): AlunoDaCoorte[] {
  if (criterio === 'sem_coorte') return [];
  const normalizados = alunos.map(normalizarAluno);

  switch (criterio) {
    case 'borda_do_corte':
      return normalizados
        .filter((a) => a.proficiencia !== null && a.proficiencia >= PISO_BASE && a.proficiencia < CORTE_PROFICIENCIA)
        .sort((a, b) => (b.proficiencia ?? 0) - (a.proficiencia ?? 0));
    case 'abaixo_da_base':
      return normalizados
        .filter((a) => a.proficiencia !== null && a.proficiencia < PISO_BASE)
        .sort((a, b) => (b.proficiencia ?? 0) - (a.proficiencia ?? 0));
    case 'acima_da_faixa':
      return normalizados
        .filter((a) => a.proficiencia !== null && a.proficiencia >= CORTE_PROFICIENCIA)
        .sort((a, b) => (b.proficiencia ?? 0) - (a.proficiencia ?? 0));
    case 'em_variacao':
      return normalizados
        .filter((a) => a.variacao !== null && Math.abs(a.variacao) >= LIMIAR_VARIACAO)
        .sort((a, b) => Math.abs(b.variacao ?? 0) - Math.abs(a.variacao ?? 0));
    case 'sem_nota':
      return normalizados.filter((a) => a.proficiencia === null).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    case 'por_semestre': {
      const alvo = opcoes.semestreAlvo ?? null;
      const lista = alvo === null ? normalizados : normalizados.filter((a) => a.semestre === alvo);
      return lista.sort((a, b) => (b.proficiencia ?? -1) - (a.proficiencia ?? -1));
    }
    default:
      return [];
  }
}

export interface Projecao {
  /** Alunos com nota na base do indicador. */
  base: number;
  /** Quantos já cruzam a faixa hoje. */
  proficientesHoje: number;
  /** Quantos do grupo o movimento pretende alcançar (pedido do plano). */
  alvoIndicado: number;
  /** Quantos entram na conta depois da taxa conservadora de conversão. */
  alvo: number;
  /** Fração do grupo que a conta assume que realmente cruza o corte. */
  taxaConversao: number;
  antesPct: number;
  depoisPct: number;
  deltaPp: number;
}

/**
 * Fração do grupo alcançado que a projeção assume que realmente cruza o corte.
 * Metade é a leitura conservadora: nem todo aluno que entra na ação converte no
 * mesmo ciclo (adesão, tempo de estudo, dificuldade do simulado seguinte).
 * Melhor prometer menos do que a tela não sustentar depois.
 */
export const TAXA_CONVERSAO_CONSERVADORA = 0.5;

/**
 * Projeção em pontos percentuais sobre a MESMA base do indicador da tela
 * (alunos com nota). Cenário, não previsão: quem exibe rotula como cenário e
 * mostra a conta.
 *
 * `null` quando não há base utilizável — sem base não há projeção, e inventar
 * um percentual aqui seria exatamente o que a regra 2 proíbe.
 */
export function projetarGanho(params: {
  base: number;
  proficientesHoje: number;
  alvo: number;
}): Projecao | null {
  const { base, proficientesHoje } = params;
  if (!Number.isFinite(base) || base <= 0) return null;
  const gap = Math.max(0, base - proficientesHoje);
  const alvoIndicado = Math.max(0, Math.min(params.alvo, gap));
  /* Conta conservadora: metade do grupo, arredondada para baixo. Com grupo
     pequeno o piso é 1 aluno — abaixo disso o cenário não existiria. */
  const alvo =
    alvoIndicado === 0 ? 0 : Math.max(1, Math.floor(alvoIndicado * TAXA_CONVERSAO_CONSERVADORA));
  const antesPct = (proficientesHoje / base) * 100;
  const depoisPct = ((proficientesHoje + alvo) / base) * 100;
  return {
    base,
    proficientesHoje,
    alvoIndicado,
    alvo,
    taxaConversao: TAXA_CONVERSAO_CONSERVADORA,
    antesPct: Number(antesPct.toFixed(1)),
    depoisPct: Number(depoisPct.toFixed(1)),
    deltaPp: Number((depoisPct - antesPct).toFixed(1)),
  };
}

/**
 * Palpite de critério a partir do texto do movimento — só usado como REDE se
 * o backend não devolver `criterio_coorte` (cliente antigo, corte de stream).
 * Nunca sobrepõe o critério explícito.
 */
export function inferirCriterio(item: {
  titulo?: string;
  texto?: string;
  natureza?: string;
}): CriterioCoorte {
  const alvo = `${item.titulo ?? ''} ${item.texto ?? ''}`.toLowerCase();
  if (/cobertur|aplica|contratad|calend[áa]rio|cronograma/.test(alvo)) return 'sem_coorte';
  if (/varia|oscil|instáv|instav|estabiliz/.test(alvo)) return 'em_variacao';
  if (/borda|logo abaixo|perto do corte|quase/.test(alvo)) return 'borda_do_corte';
  if (/recupera|base|muito abaixo|bem abaixo/.test(alvo)) return 'abaixo_da_base';
  if (/calibra|sem nota/.test(alvo)) return 'sem_nota';
  if (item.natureza === 'cobertura' || item.natureza === 'calendario') return 'sem_coorte';
  if (item.natureza === 'manejo_de_prova') return 'em_variacao';
  return 'borda_do_corte';
}

/** Semestre citado no título/texto do movimento ("11º", "8º semestre"). */
export function inferirSemestreAlvo(item: { titulo?: string; texto?: string }): number | null {
  const alvo = `${item.titulo ?? ''} ${item.texto ?? ''}`;
  const match = /(\d{1,2})\s*º?\s*semestre/i.exec(alvo) ?? /(\d{1,2})º/.exec(alvo);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}
