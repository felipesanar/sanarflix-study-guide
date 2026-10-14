import { parseEmailsParam } from '@/features/mentor/lib/emailsParam';
import type {
  AlunoDesempenho,
  DesempenhoTurma,
  QuestaoDetalhe,
} from '@/services/mentor/desempenho';

export type OrdenacaoQuestoes = 'ordem_da_prova' | 'mais_erradas' | 'mais_acertadas';

export const ORDENACOES: { valor: OrdenacaoQuestoes; rotulo: string }[] = [
  { valor: 'ordem_da_prova', rotulo: 'Ordem da prova' },
  { valor: 'mais_erradas', rotulo: 'Mais erradas' },
  { valor: 'mais_acertadas', rotulo: 'Mais acertadas' },
];

const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** "61,5%"; "–" quando não há valor. */
export function formatPct(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '–';
  return `${NUM.format(valor)}%`;
}

/** "+3,2 p.p." / "−1 p.p." / "0 p.p.". */
export function formatDeltaPp(valor: number): string {
  const arred = Math.round(valor * 10) / 10;
  if (arred === 0) return '0 p.p.';
  return `${arred > 0 ? '+' : '−'}${NUM.format(Math.abs(arred))} p.p.`;
}

export function formatRespostas(n: number): string {
  return `${NUM.format(n)} ${n === 1 ? 'resposta' : 'respostas'}`;
}

export interface SimuladoDisponivel {
  id: string;
  sequence_number: number;
  rotulo: string;
  /** Data da última finalização no simulado (ISO). */
  ultima_finalizacao: string;
}

export function rotuloSimulado(sequence: number): string {
  return `Simulado ${sequence}`;
}

/** Simulados com ao menos uma nota na turma, do mais antigo para o mais recente. */
export function simuladosDisponiveis(alunos: AlunoDesempenho[]): SimuladoDisponivel[] {
  const mapa = new Map<string, SimuladoDisponivel>();
  for (const aluno of alunos) {
    for (const nota of aluno.notas ?? []) {
      const atual = mapa.get(nota.simulado_id);
      if (!atual) {
        mapa.set(nota.simulado_id, {
          id: nota.simulado_id,
          sequence_number: nota.sequence_number,
          rotulo: rotuloSimulado(nota.sequence_number),
          ultima_finalizacao: nota.finalizada_em,
        });
      } else if (nota.finalizada_em > atual.ultima_finalizacao) {
        atual.ultima_finalizacao = nota.finalizada_em;
      }
    }
  }
  return [...mapa.values()].sort((a, b) => a.sequence_number - b.sequence_number);
}

/** O mais recente = maior número de sequência. */
export function simuladoMaisRecente(lista: SimuladoDisponivel[]): SimuladoDisponivel | null {
  return lista.length ? lista[lista.length - 1] : null;
}

/** Mantém a ordem cronológica (por sequência) dos ids escolhidos. */
export function ordenarSelecao(ids: string[], lista: SimuladoDisponivel[]): string[] {
  const posicao = new Map(lista.map((s, i) => [s.id, i]));
  return [...ids].sort((a, b) => (posicao.get(a) ?? 0) - (posicao.get(b) ?? 0));
}

/** "Simulado 3" ou "Simulado 3 · em andamento". */
export function rotuloSimuladoAtual(sequence: number, emAndamento: boolean): string {
  return emAndamento ? `${rotuloSimulado(sequence)} · em andamento` : rotuloSimulado(sequence);
}

export interface IndicadoresSimulado {
  simulado_id: string;
  sequence_number: number;
  /** Média do % de acerto de quem fez este simulado; null se ninguém fez. */
  acerto_medio: number | null;
  fizeram: number;
  /** Alunos da turma (denominador da participação). */
  total: number;
  /** % da turma que fez este simulado; null com turma vazia. */
  participacao_pct: number | null;
  /** Alunos que fizeram e têm corte cadastrado (denominador da possível aprovação). */
  com_corte: number;
  /** Desses, quantos alcançaram o corte (acerto >= corte_mais_dificil). */
  no_corte: number;
  /** % no corte entre os que têm corte; null quando ninguém tem corte. */
  possivel_aprovacao_pct: number | null;
}

/**
 * Indicadores calculados no cliente, simulado a simulado, a partir das notas
 * dos alunos. Não dependem do "último encerrado" da RPC: valem para qualquer
 * simulado do recorte, aberto ou encerrado.
 */
export function indicadoresPorSimulado(
  alunos: AlunoDesempenho[],
  selecionados: Pick<SimuladoDisponivel, 'id' | 'sequence_number'>[],
): IndicadoresSimulado[] {
  const total = alunos.length;
  return selecionados.map((sim) => {
    let fizeram = 0;
    let soma = 0;
    let comCorte = 0;
    let noCorte = 0;
    for (const aluno of alunos) {
      const nota = aluno.notas?.find((n) => n.simulado_id === sim.id);
      if (!nota) continue;
      fizeram += 1;
      soma += nota.acerto_pct;
      if (aluno.corte_mais_dificil !== null && aluno.corte_mais_dificil !== undefined) {
        comCorte += 1;
        if (nota.acerto_pct >= aluno.corte_mais_dificil) noCorte += 1;
      }
    }
    return {
      simulado_id: sim.id,
      sequence_number: sim.sequence_number,
      acerto_medio: fizeram > 0 ? soma / fizeram : null,
      fizeram,
      total,
      participacao_pct: total > 0 ? (fizeram / total) * 100 : null,
      com_corte: comCorte,
      no_corte: noCorte,
      possivel_aprovacao_pct: comCorte > 0 ? (noCorte / comCorte) * 100 : null,
    };
  });
}

export interface SimuladoAtual {
  atual: IndicadoresSimulado | null;
  /** Simulado anterior ao atual dentro da seleção (base do "vs."). */
  anterior: IndicadoresSimulado | null;
  /** true quando o atual não é o último simulado encerrado da RPC. */
  emAndamento: boolean;
}

/**
 * "Atual" = o último simulado encerrado da RPC (`participacao_ultimo.simulado_id`)
 * se estiver na seleção; senão, o último da seleção com notas (em andamento).
 * `indicadores` vem em ordem cronológica.
 */
export function escolherAtual(
  indicadores: IndicadoresSimulado[],
  encerradoId: string | null | undefined,
): SimuladoAtual {
  let idx = encerradoId ? indicadores.findIndex((i) => i.simulado_id === encerradoId) : -1;
  const encerrado = idx >= 0;
  if (!encerrado) {
    for (let i = indicadores.length - 1; i >= 0; i -= 1) {
      if (indicadores[i].fizeram > 0) {
        idx = i;
        break;
      }
    }
    if (idx < 0 && indicadores.length > 0) idx = indicadores.length - 1;
  }
  if (idx < 0) return { atual: null, anterior: null, emAndamento: false };
  return {
    atual: indicadores[idx],
    anterior: idx > 0 ? indicadores[idx - 1] : null,
    emAndamento: !encerrado,
  };
}

export function ordenarQuestoes(questoes: QuestaoDetalhe[], ordem: OrdenacaoQuestoes): QuestaoDetalhe[] {
  const porProva = (a: QuestaoDetalhe, b: QuestaoDetalhe) =>
    a.sequence_number - b.sequence_number || a.numero - b.numero;
  const copia = [...questoes];
  if (ordem === 'mais_erradas') return copia.sort((a, b) => a.acerto_pct - b.acerto_pct || porProva(a, b));
  if (ordem === 'mais_acertadas') return copia.sort((a, b) => b.acerto_pct - a.acerto_pct || porProva(a, b));
  return copia.sort(porProva);
}

export interface AlternativaDistribuicao {
  letra: string;
  contagem: number;
  pct: number;
  correta: boolean;
  dominante: boolean;
}

/** Distrator dominante = alternativa errada (letra) mais marcada; sem marcações, não há. */
export function derivarDistribuicao(questao: QuestaoDetalhe): {
  alternativas: AlternativaDistribuicao[];
  branco: number;
  brancoPct: number;
} {
  const dist = questao.distribuicao ?? {};
  const total = Object.values(dist).reduce((acc, n) => acc + n, 0);
  const letras = new Set(Object.keys(dist).filter((k) => k !== 'branco'));
  if (questao.correta_label) letras.add(questao.correta_label);
  const ordenadas = [...letras].sort();

  let dominante: string | null = null;
  let maior = 0;
  for (const letra of ordenadas) {
    if (letra === questao.correta_label) continue;
    const n = dist[letra] ?? 0;
    if (n > maior) {
      maior = n;
      dominante = letra;
    }
  }

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  return {
    alternativas: ordenadas.map((letra) => ({
      letra,
      contagem: dist[letra] ?? 0,
      pct: pct(dist[letra] ?? 0),
      correta: letra === questao.correta_label,
      dominante: letra === dominante,
    })),
    branco: dist.branco ?? 0,
    brancoPct: pct(dist.branco ?? 0),
  };
}

/** Rota do Mural com todos os destinatários em `?para=` (lista separada por vírgula). */
export function urlMural(emails: string[]): string {
  const p = new URLSearchParams({ para: parseEmailsParam(emails.join(',')).join(',') });
  return `/mentor/mural?${p.toString()}`;
}

/** Rota de Intervenções com o criador aberto e todos os alunos em `?alunos=`. */
export function urlIntervencao(emails: string[]): string {
  const p = new URLSearchParams({ novo: '1', alunos: parseEmailsParam(emails.join(',')).join(',') });
  return `/mentor/intervencoes?${p.toString()}`;
}

export function classeAcerto(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}
