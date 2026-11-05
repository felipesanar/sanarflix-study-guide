/**
 * Diagnóstico da IA do Detalhamento (docs/08 Fase 2 · 2.4). Hook local (fora de `api/queries.ts`, por
 * decisão da tarefa): chama a Edge `mentor-ai-insights` com o JWT do usuário (`fetchIa` do Gestor).
 *
 * - O servidor guarda em `ai_response_cache` com chave modalidade + mentor + simulados: abrir a tela de
 *   novo (F5, outra aba) não gera de novo.
 * - "Gerar de novo" manda `refresh: true`, que ignora o cache e regrava.
 * - `VITE_MENTOR_FONTE=mock`: devolve o texto do protótipo, sem rede (só dev/testes).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchIa } from '@/features/gestor/lib/fetchIa';
import { escolherFonte, lerConfigFonte } from '@/features/mentor/api/ativa';
import { ErroFonte } from '@/features/mentor/api/fonte';

export interface ItemDiagnostico { destaque: string; texto: string }
export interface DiagnosticoIa {
  resumo: string;
  itens: ItemDiagnostico[];
  /** ISO; null quando a fonte não informou. */
  geradoEm: string | null;
}

export const chaveDiagnostico = (modalidade: 'b2c' | 'b2b', simulados: string[]) =>
  ['mentor', 'ia', 'diagnostico', modalidade, [...simulados].sort()] as const;

function lerResposta(bruto: unknown): DiagnosticoIa {
  const r = (bruto ?? {}) as Record<string, unknown>;
  const itens = Array.isArray(r.itens) ? r.itens : [];
  return {
    resumo: typeof r.resumo === 'string' ? r.resumo : '',
    itens: itens
      .map((i) => (i ?? {}) as Record<string, unknown>)
      .filter((i) => typeof i.destaque === 'string' || typeof i.texto === 'string')
      .map((i) => ({ destaque: String(i.destaque ?? ''), texto: String(i.texto ?? '') })),
    geradoEm: typeof r.geradoEm === 'string' ? r.geradoEm : null,
  };
}

const MOCK: Record<'b2c' | 'b2b', DiagnosticoIa> = {
  b2c: {
    resumo: 'A turma subiu 2 p.p. no geral, mas a alta prevalência ainda pesa em Preventiva. O ganho veio de média e baixa prevalência, que pesam menos na prova.',
    itens: [
      { destaque: 'Preventiva em alta prevalência: 58%.', texto: 'É a pior célula da matriz; Vigilância em Saúde concentra o erro.' },
      { destaque: 'Q12: 27 alunos marcaram a mesma errada.', texto: 'Erro concentrado num distrator indica confusão de conceito, não falta de estudo.' },
      { destaque: 'Os próximos do corte', texto: 'erram mais Preventiva do que a média da turma.' },
      { destaque: 'Clínica Médica e Saúde Mental', texto: 'ficam acima de 80% nas três faixas e seguram a nota.' },
    ],
    geradoEm: '2026-09-21T12:00:00-03:00',
  },
  b2b: {
    resumo: 'O TRI projetado subiu 1,2 ponto, mas a turma segue abaixo de 60. Preventiva em alta prevalência concentra os erros e pesa mais na prova.',
    itens: [
      { destaque: 'Preventiva em alta prevalência: 43%.', texto: 'É a pior célula da matriz; Vigilância em Saúde concentra o erro.' },
      { destaque: 'Q12: o distrator C domina.', texto: 'Erro concentrado num distrator indica confusão de conceito.' },
      { destaque: '23 alunos com potencial de virada', texto: 'erram mais Preventiva do que a média da turma.' },
      { destaque: 'Saúde Mental e Clínica Médica', texto: 'são as áreas com maior acerto e seguram o TRI.' },
    ],
    geradoEm: '2026-10-01T12:00:00-03:00',
  },
};

async function buscar(modalidade: 'b2c' | 'b2b', simulados: string[], refresh: boolean): Promise<DiagnosticoIa> {
  if (escolherFonte(lerConfigFonte()) === 'mock') {
    await new Promise((r) => setTimeout(r, 300));
    return MOCK[modalidade];
  }
  const resposta = await fetchIa('mentor-ai-insights', { modalidade, simulados, refresh });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroFonte(resposta.status, resposta.status >= 500 ? 'rede' : 'desconhecido', String((corpo as { error?: unknown })?.error ?? 'ia'));
  }
  return lerResposta(corpo);
}

export function useDiagnosticoIa(modalidade: 'b2c' | 'b2b', simulados: string[]) {
  const qc = useQueryClient();
  const chave = chaveDiagnostico(modalidade, simulados);
  const consulta = useQuery({
    queryKey: chave,
    enabled: simulados.length > 0,
    // A leitura só muda quando o mentor pede "Gerar de novo" (o servidor também guarda em cache).
    staleTime: Infinity,
    retry: false,
    queryFn: () => buscar(modalidade, simulados, false),
  });
  const gerar = useMutation({
    mutationFn: () => buscar(modalidade, simulados, true),
    onSuccess: (novo) => qc.setQueryData(chave, novo),
  });
  return {
    data: consulta.data,
    gerando: consulta.isFetching || gerar.isPending,
    erro: (gerar.isError ? gerar.error : consulta.isError ? consulta.error : null) as unknown,
    gerarDeNovo: () => gerar.mutateAsync(),
    tentarNovamente: () => { gerar.reset(); void consulta.refetch(); },
  };
}
