import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { AdminEmpty, AdminError, AdminLoading, AdminSectionHeader } from '@/experiences/admin/ui';
import { KpisRede } from '@/components/admin/engajamento/KpisRede';
import { useAdminEngajamento } from '@/services/admin/engajamento';
import {
  calcularPeriodo,
  hojeSaoPaulo,
  rotuloOpcaoSemestre,
  type OpcaoPeriodoAdmin,
} from '@/features/gestor/lib/engajamento';

const OPCOES_PERIODO: OpcaoPeriodoAdmin[] = ['6m', '30d', 'ano'];
const SEMESTRES = Array.from({ length: 12 }, (_, i) => i + 1);

const CONTROLE =
  'h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Opção do seletor de período e o mesmo texto em minúsculas para o subtítulo (§12.5). */
function rotuloPeriodo(opcao: OpcaoPeriodoAdmin, hoje: string): string {
  if (opcao === '6m') return 'Últimos 6 meses';
  if (opcao === '30d') return 'Últimos 30 dias';
  return hoje.slice(0, 4);
}

function lerPeriodo(bruto: string | null): OpcaoPeriodoAdmin {
  return OPCOES_PERIODO.includes(bruto as OpcaoPeriodoAdmin) ? (bruto as OpcaoPeriodoAdmin) : '6m';
}

function lerSemestre(bruto: string | null): number | null {
  const n = Number(bruto);
  return bruto !== null && Number.isInteger(n) && n >= 1 && n <= 12 ? n : null;
}

/**
 * Admin › Engajamento SanarFlix (`/admin/engajamento`, spec 2026-10-22-engajamento §9.5,
 * §10.8, §12.5). Mostra a rede B2B inteira, comparando IES; nenhuma resposta traz dado
 * individual de aluno. Estado na URL: `periodo` (`6m` | `30d` | `ano`) e `sem` (1–12);
 * valor inválido cai no padrão.
 */
const EngajamentoSanarflixPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const hoje = hojeSaoPaulo();
  const periodo = lerPeriodo(params.get('periodo'));
  const semestre = lerSemestre(params.get('sem'));
  const { inicio, fim } = calcularPeriodo(periodo, hoje);

  const consulta = useAdminEngajamento(inicio, fim, semestre);
  const dados = consulta.data;

  const escrever = (mudanca: (p: URLSearchParams) => void) => {
    const proximos = new URLSearchParams(params);
    mudanca(proximos);
    setParams(proximos, { replace: true });
  };
  const definirPeriodo = (p: OpcaoPeriodoAdmin) => escrever((q) => (p === '6m' ? q.delete('periodo') : q.set('periodo', p)));
  const definirSemestre = (n: number | null) => escrever((q) => (n === null ? q.delete('sem') : q.set('sem', String(n))));

  const subtitulo = dados
    ? `Rede B2B · ${dados.rede.ies} IES · ${rotuloPeriodo(periodo, hoje).toLowerCase()} · sem dados individuais de aluno — para isso, abra o portal do gestor da IES`
    : 'Rede B2B · sem dados individuais de aluno — para isso, abra o portal do gestor da IES';

  return (
    <div className="space-y-6" data-testid="engajamento-admin">
      <AdminSectionHeader
        title="Engajamento por instituição"
        subtitle={subtitulo}
        actions={
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor="eng-admin-periodo" className="text-xs font-semibold text-muted-foreground">
                Período
              </label>
              <select id="eng-admin-periodo" value={periodo} onChange={(e) => definirPeriodo(e.target.value as OpcaoPeriodoAdmin)} className={CONTROLE}>
                {OPCOES_PERIODO.map((o) => (
                  <option key={o} value={o}>
                    {rotuloPeriodo(o, hoje)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="eng-admin-semestre" className="text-xs font-semibold text-muted-foreground">
                Semestre do aluno
              </label>
              <select
                id="eng-admin-semestre"
                value={semestre === null ? '' : String(semestre)}
                onChange={(e) => definirSemestre(e.target.value === '' ? null : Number(e.target.value))}
                className={CONTROLE}
              >
                <option value="">Todos (1º ao 12º)</option>
                {SEMESTRES.map((n) => (
                  <option key={n} value={n}>
                    {rotuloOpcaoSemestre(n)}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      {semestre !== null ? (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Página filtrada por</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background py-0.5 pl-2.5 pr-1 font-semibold text-foreground">
            {semestre}º semestre
            <button type="button" aria-label="Remover filtro" onClick={() => definirSemestre(null)} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full hover:bg-muted">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
          <span>Indicadores, ranking e gráficos mostram só alunos deste semestre em todas as IES.</span>
        </div>
      ) : null}

      {consulta.isError && !dados ? (
        <AdminError message="Não foi possível carregar o engajamento da rede." onRetry={() => consulta.refetch()} />
      ) : !dados ? (
        <AdminLoading rows={4} />
      ) : (
        <>
          <KpisRede rede={dados.rede} semestre={semestre} />
          {dados.ranking.length === 0 ? (
            <AdminEmpty title="Nenhuma instituição com alunos ativos neste recorte." />
          ) : null}
        </>
      )}
    </div>
  );
};

export default EngajamentoSanarflixPage;
