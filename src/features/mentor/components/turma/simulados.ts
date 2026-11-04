import type { AlunoDesempenho, DesempenhoTurma, SimuladoB2C, SituacaoMeta } from '@/services/mentor/desempenho';

/** Um simulado que aparece como chip/coluna: o rótulo é "Simulado N" (o `titulo` vai no tooltip). */
export type OpcaoSimulado = SimuladoB2C;

export type AlertaFiltro = 'nao_fez' | 'regrediu' | 'estagnado';

export const ALERTA_ROTULO: Record<AlertaFiltro, string> = {
  nao_fez: 'Não fizeram o último simulado',
  regrediu: 'Regrediram',
  estagnado: 'Estagnados',
};

export function ehAlertaFiltro(valor: string | null): valor is AlertaFiltro {
  return valor === 'nao_fez' || valor === 'regrediu' || valor === 'estagnado';
}

export const SITUACOES: SituacaoMeta[] = ['acima', 'proximo', 'longe', 'sem_meta', 'sem_simulado'];

export const SITUACAO_ROTULO: Record<SituacaoMeta, string> = {
  acima: 'Acima do corte',
  proximo: 'Próximo',
  longe: 'Longe',
  sem_meta: 'Sem meta',
  sem_simulado: 'Sem simulado',
};

export const SITUACAO_CLASSE: Record<SituacaoMeta, string> = {
  acima: 'bg-emerald-100 text-emerald-800',
  proximo: 'bg-amber-100 text-amber-800',
  longe: 'bg-red-100 text-red-800',
  sem_meta: 'bg-muted text-muted-foreground',
  sem_simulado: 'bg-muted text-muted-foreground',
};

/** Só existe leitura de simulados quando algum aluno da turma tem nota. */
export function temDadosSimulado(d: DesempenhoTurma | null | undefined): boolean {
  return !!d && d.alunos.some((a) => (a.notas ?? []).length > 0);
}

/** Simulados B2C publicados (lista da RPC, sem recorte), na ordem do simulado (sequence_number). */
export function opcoesSimulados(d: Pick<DesempenhoTurma, 'simulados'> | null | undefined): OpcaoSimulado[] {
  return [...(d?.simulados ?? [])].sort((x, y) => x.sequence_number - y.sequence_number);
}

/** Número do "último" simulado (`participacao_ultimo.simulado_id`), resolvido pela lista da RPC. */
export function numeroUltimoSimulado(d: DesempenhoTurma): number | null {
  const id = d.participacao_ultimo?.simulado_id;
  if (!id) return null;
  return (d.simulados ?? []).find((o) => o.id === id)?.sequence_number ?? null;
}

export function contarAlertas(alunos: AlunoDesempenho[]): Record<AlertaFiltro, number> {
  return {
    regrediu: alunos.filter((a) => a.regrediu === true).length,
    estagnado: alunos.filter((a) => a.estagnado === true).length,
    nao_fez: alunos.filter((a) => a.fez_ultimo === false).length,
  };
}

export function passaAlerta(a: AlunoDesempenho | undefined, alerta: AlertaFiltro): boolean {
  if (!a) return false;
  if (alerta === 'regrediu') return a.regrediu === true;
  if (alerta === 'estagnado') return a.estagnado === true;
  return a.fez_ultimo === false;
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Implementação única em `detalhamento/util.ts` (aceita nulo e devolve "–"). */
export { formatPct } from '../detalhamento/util';

/** Distância em pontos percentuais, com sinal: "+3,2 p.p." / "-4 p.p.". */
export function formatPp(valor: number): string {
  const sinal = valor > 0 ? '+' : '';
  return `${sinal}${nf.format(valor)} p.p.`;
}
