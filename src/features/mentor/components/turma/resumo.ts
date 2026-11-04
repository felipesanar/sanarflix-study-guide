import type { AlunoDesempenho } from '@/services/mentor/desempenho';
import type { OpcaoSimulado } from './simulados';

/**
 * Regras da tela "Minha turma" (tela 02) calculadas no cliente, sobre as notas
 * que já vêm de `mentor_desempenho_turma`. Funções puras, sem React.
 */

// ---------------------------------------------------------------------------
// Segmentos de histórico
// ---------------------------------------------------------------------------

export type SegmentoHistorico = 'acima' | 'variacao' | 'abaixo' | 'sem_historico';

export const SEGMENTOS_HISTORICO: SegmentoHistorico[] = ['acima', 'variacao', 'abaixo', 'sem_historico'];

export const SEGMENTO_HISTORICO_ROTULO: Record<SegmentoHistorico, string> = {
  acima: 'Constantemente acima do corte',
  variacao: 'Em variação',
  abaixo: 'Constantemente abaixo',
  sem_historico: 'Sem histórico',
};

/**
 * Segmento do aluno sobre as notas DENTRO do recorte (`ids`; omitido = todas):
 * - sem corte ou menos de 2 notas → sem histórico;
 * - todas as notas >= corte (exatamente no corte conta como acima) → acima;
 * - todas < corte → abaixo;
 * - misturado → em variação.
 */
export function segmentoHistorico(
  aluno: Pick<AlunoDesempenho, 'notas' | 'corte_mais_dificil'> | undefined,
  ids?: ReadonlySet<string> | null,
): SegmentoHistorico {
  const corte = aluno?.corte_mais_dificil;
  if (!aluno || corte == null) return 'sem_historico';
  const notas = (aluno.notas ?? []).filter((n) => !ids || ids.has(n.simulado_id));
  if (notas.length < 2) return 'sem_historico';
  const acima = notas.filter((n) => n.acerto_pct >= corte).length;
  if (acima === notas.length) return 'acima';
  if (acima === 0) return 'abaixo';
  return 'variacao';
}

export function contarSegmentosHistorico(
  alunos: Pick<AlunoDesempenho, 'notas' | 'corte_mais_dificil'>[],
  ids?: ReadonlySet<string> | null,
): Record<SegmentoHistorico, number> {
  const c: Record<SegmentoHistorico, number> = { acima: 0, variacao: 0, abaixo: 0, sem_historico: 0 };
  for (const a of alunos) c[segmentoHistorico(a, ids)] += 1;
  return c;
}

// ---------------------------------------------------------------------------
// Resumo por simulado (cards)
// ---------------------------------------------------------------------------

export interface ResumoSimulado {
  simulado: OpcaoSimulado;
  /** Média de acerto de quem fez; null se ninguém fez (ausência nunca entra na média). */
  acertoMedio: number | null;
  participacao: { fizeram: number; total: number };
  /** % dos alunos COM corte e nota no simulado cuja nota >= corte; null sem denominador. */
  possivelAprovacao: number | null;
}

export function resumoPorSimulado(alunos: AlunoDesempenho[], simulado: OpcaoSimulado): ResumoSimulado {
  const notas = alunos
    .map((a) => ({ corte: a.corte_mais_dificil, nota: (a.notas ?? []).find((n) => n.simulado_id === simulado.id) }))
    .filter((x): x is { corte: number | null; nota: NonNullable<typeof x.nota> } => !!x.nota);
  const comCorte = notas.filter((x) => x.corte != null);
  return {
    simulado,
    acertoMedio: notas.length === 0 ? null : notas.reduce((t, x) => t + x.nota.acerto_pct, 0) / notas.length,
    participacao: { fizeram: notas.length, total: alunos.length },
    possivelAprovacao:
      comCorte.length === 0
        ? null
        : (100 * comCorte.filter((x) => x.nota.acerto_pct >= (x.corte as number)).length) / comCorte.length,
  };
}

export interface SimuladosDosCards {
  /** Simulado "Atual"; `emAndamento` quando a lista da RPC o marca como não encerrado (`encerrado === false`). */
  atual: { simulado: OpcaoSimulado; emAndamento: boolean } | null;
  anterior: OpcaoSimulado | null;
  primeiro: OpcaoSimulado | null;
}

/**
 * Escolhe Primeiro / Anterior / Atual dentro do recorte (`recorte` em ordem de
 * sequence_number).
 * - Atual = último simulado encerrado da RPC (`participacao_ultimo.simulado_id`) se
 *   estiver no recorte, mesmo sem nenhuma nota; senão o último do recorte com nota.
 *   "Em andamento" vem de `encerrado === false` na lista da RPC, não de inferência.
 * - Anterior = o simulado imediatamente antes do Atual no recorte (com ou sem nota).
 * - Primeiro = o primeiro do recorte; some se coincidir com Atual ou Anterior.
 */
export function escolherSimuladosDosCards(
  recorte: OpcaoSimulado[],
  alunos: AlunoDesempenho[],
  ultimoEncerradoId: string | null | undefined,
): SimuladosDosCards {
  const ordenado = [...recorte].sort((a, b) => a.sequence_number - b.sequence_number);
  const temNota = (o: OpcaoSimulado) => alunos.some((a) => (a.notas ?? []).some((n) => n.simulado_id === o.id));

  const doRpc = ultimoEncerradoId ? ordenado.find((o) => o.id === ultimoEncerradoId) : undefined;
  const escolhido = doRpc ?? [...ordenado].reverse().find(temNota);
  if (!escolhido) return { atual: null, anterior: null, primeiro: null };
  const atual = { simulado: escolhido, emAndamento: escolhido.encerrado === false };

  const idx = ordenado.findIndex((o) => o.id === escolhido.id);
  const anterior = idx > 0 ? ordenado[idx - 1] : null;
  const primeiro = ordenado[0];
  return {
    atual,
    anterior,
    primeiro: primeiro.id === escolhido.id || primeiro.id === anterior?.id ? null : primeiro,
  };
}

/** Alunos sem nota no simulado (os "N que não fizeram"). */
export function semNotaNoSimulado(alunos: AlunoDesempenho[], simuladoId: string): AlunoDesempenho[] {
  return alunos.filter((a) => !(a.notas ?? []).some((n) => n.simulado_id === simuladoId));
}
