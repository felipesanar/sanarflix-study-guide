import type {
  CardIntervencao,
  StatusIntervencao,
  TipoIntervencao,
} from '@/services/mentor/intervencoes';
import type { AlunoTurma } from '@/services/mentor/turma';

export const FUSO = 'America/Sao_Paulo';

export const TIPOS: { valor: TipoIntervencao; rotulo: string }[] = [
  { valor: 'reuniao_individual', rotulo: 'Reunião individual' },
  { valor: 'reuniao_coletiva', rotulo: 'Reunião coletiva' },
  { valor: 'mensagem_mural', rotulo: 'Mensagem no mural' },
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'outro', rotulo: 'Outro' },
];

export const STATUS: { valor: StatusIntervencao; rotulo: string }[] = [
  { valor: 'a_fazer', rotulo: 'A fazer' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'feito', rotulo: 'Feito' },
];

export const rotuloTipo = (t: TipoIntervencao): string => TIPOS.find((x) => x.valor === t)?.rotulo ?? t;
export const rotuloStatus = (s: StatusIntervencao): string => STATUS.find((x) => x.valor === s)?.rotulo ?? s;

const ORIGENS: Record<string, string> = {
  mural_post: 'Mural',
  sessao: 'Sessão',
  agenda_liberacao: 'Agenda liberada',
};

/** "Auto · Mural" para cards automáticos; "Manual" para os criados na mão. */
export function rotuloOrigem(card: Pick<CardIntervencao, 'origem' | 'origem_ref'>): string {
  if (card.origem !== 'auto') return 'Manual';
  const kind = card.origem_ref?.kind;
  return kind ? `Auto · ${ORIGENS[kind] ?? kind}` : 'Auto';
}

export const mapaAlunos = (turma: AlunoTurma[] | undefined): Map<string, AlunoTurma> =>
  new Map((turma ?? []).map((a) => [a.email, a]));

export const nomeAluno = (email: string, mapa: Map<string, AlunoTurma>): string => mapa.get(email)?.nome || email;

/** Aluno / "Turma toda" / "N alunos". */
export function rotuloAlvo(card: Pick<CardIntervencao, 'alvo' | 'alunos'>, mapa: Map<string, AlunoTurma>): string {
  if (card.alvo === 'turma') return 'Turma toda';
  if (card.alunos.length === 1) return nomeAluno(card.alunos[0], mapa);
  if (card.alunos.length === 0) return 'Sem aluno';
  return `${card.alunos.length} alunos`;
}



// ----- datas (America/Sao_Paulo) -----

const fmtYmd = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Data YYYY-MM-DD de hoje no fuso de São Paulo. */
export const hojeSP = (agora: Date = new Date()): string => fmtYmd.format(agora);

const parse = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (d: Date): string => d.toISOString().slice(0, 10);

export const somarDias = (ymd: string, dias: number): string => {
  const d = parse(ymd);
  d.setUTCDate(d.getUTCDate() + dias);
  return fmt(d);
};

export type PeriodoId = 'semana' | 'quinzena' | 'mes' | 'custom';

export const PERIODOS: { valor: PeriodoId; rotulo: string }[] = [
  { valor: 'semana', rotulo: 'Esta semana' },
  { valor: 'quinzena', rotulo: 'Quinzena' },
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'custom', rotulo: 'Personalizado' },
];

/** Intervalo [de, ate] do período; quinzena = últimos 15 dias incluindo hoje; semana começa na segunda. */
export function intervaloPeriodo(
  periodo: PeriodoId,
  hoje: string,
  custom?: { de: string; ate: string },
): { de: string; ate: string } {
  switch (periodo) {
    case 'semana': {
      const dow = parse(hoje).getUTCDay(); // 0 = domingo
      return { de: somarDias(hoje, -((dow + 6) % 7)), ate: hoje };
    }
    case 'quinzena':
      return { de: somarDias(hoje, -14), ate: hoje };
    case 'mes':
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case 'custom':
      return custom && custom.de && custom.ate ? custom : { de: somarDias(hoje, -14), ate: hoje };
  }
}

export const formatarDataCurta = (iso: string): string =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: FUSO });

export const formatarDataHora = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: FUSO,
  });
