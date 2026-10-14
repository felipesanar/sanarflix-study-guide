import type {
  AlunoDesempenho,
  DesempenhoTurma,
  QuestaoDetalhe,
} from '@/services/mentor/desempenho';

/** Chave usada para repassar a lista de destinatários ao Mural (Mural lê só um e-mail em `?para=`). */
export const MURAL_PARA_STORAGE_KEY = 'mentor.mural.para';

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

export interface ResumoSimulado {
  simulado_id: string;
  acerto_medio: number | null;
  fizeram: number;
  total: number;
}

/** Acerto médio e participação por simulado, calculados das notas da turma. */
export function resumoPorSimulado(desempenho: DesempenhoTurma, ids: string[]): ResumoSimulado[] {
  const total = desempenho.alunos.length;
  return ids.map((id) => {
    const notas = desempenho.alunos
      .map((a) => a.notas?.find((n) => n.simulado_id === id))
      .filter((n): n is NonNullable<typeof n> => !!n);
    const soma = notas.reduce((acc, n) => acc + n.acerto_pct, 0);
    return {
      simulado_id: id,
      acerto_medio: notas.length ? soma / notas.length : null,
      fizeram: notas.length,
      total,
    };
  });
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

/** Rota do Mural com a lista de destinatários (e a cópia em sessionStorage para o Mural ler a lista inteira). */
export function urlMural(emails: string[]): string {
  const p = new URLSearchParams({ para: emails.join(',') });
  return `/mentor/mural?${p.toString()}`;
}

/** Limitação: a criação de intervenção aceita um aluno por vez — vai o primeiro da lista. */
export function urlIntervencao(emails: string[]): string {
  const p = new URLSearchParams({ novo: '1', aluno: emails[0] ?? '' });
  return `/mentor/intervencoes?${p.toString()}`;
}

export function guardarDestinatariosMural(emails: string[]): void {
  try {
    window.sessionStorage.setItem(MURAL_PARA_STORAGE_KEY, JSON.stringify(emails));
  } catch {
    // sem sessionStorage (janela privada / bloqueado): a URL já leva a lista.
  }
}

export function classeAcerto(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}
