import { useId, useState } from 'react';
import type { Meta } from '@/features/gestor/api/types';
import { Icon } from '@/features/gestor/components/Icon';
import { KpiCard } from '@/features/gestor/components/KpiCard';
import { TagDelta } from '@/features/gestor/components/Tag';
import { TRACO, formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import { PROFICIENCIA_MINIMA, calcularVariacao } from '@/features/gestor/lib/regras';
import type { IndicadorB2b, VisaoGeralB2b } from '../../api/types';
import { GraficoProficiencia } from './GraficoProficiencia';
import { FOCO } from './SeletorPeriodo';
import { ordinal, pontosValidos, regua3 } from './util';

/**
 * TODO(contrato-b2b): `mentor_visao_geral_b2b` devolve `faltam_para_proximo_conceito` (alunos que faltam para o
 * conceito seguinte ao atual, faixas 40/60/75/90% de proficientes; null no conceito 5). O campo ainda não está
 * em `VisaoGeralB2b`: lido de forma opcional na forma camelCase do mapper, nunca calculado aqui.
 */
type VisaoComFaixa = VisaoGeralB2b & { faltamParaProximoConceito?: number | null };
function proximoConceito(visao: VisaoGeralB2b): { alunos: number; conceito: number } | null {
  const alunos = (visao as VisaoComFaixa).faltamParaProximoConceito;
  const atual = visao.conceitoEnamed.valor;
  if (alunos == null || alunos <= 0 || atual === null || Math.round(atual) >= 5) return null;
  return { alunos, conceito: Math.round(atual) + 1 };
}

const GLOSSARIO: { termo: string; definicao: string }[] = [
  { termo: 'Conceito ENAMED previsto', definicao: 'Projeção institucional na escala 1 a 5, derivada do % de alunos proficientes no simulado. Com 2+ simulados é comparativo por simulado, nunca média.' },
  { termo: 'Proficiência (0 a 100)', definicao: 'Nota na escala TRI do simulado. É a mesma métrica que o pedido chamou de "TRI projetado"; o Gestor não usa "Nota TRI" como métrica separada.' },
  { termo: 'Proficiente', definicao: 'Aluno com proficiência 60 ou mais. Quem não fez aparece como —, nunca como zero.' },
  { termo: 'Percentual de acerto', definicao: 'Resultado observado: questões certas sobre respondidas. Crítico abaixo de 50%, excelente a partir de 80%.' },
];

/** Delta só com 2 pontos válidos (docs/05 § Regras transversais). */
function deltaValido(ind: IndicadorB2b): number | null {
  return pontosValidos(ind.serie).length >= 2 ? ind.delta : null;
}

/**
 * Linha do número do `KpiCard` (mesma anatomia: 44px/800/-0.035em, sufixo 13px, delta `kpi`) com o valor em
 * verde quando a média atinge o corte (docs/03: "Valor fica verde quando ≥ 60"). O `KpiCard` não tem prop de
 * tom; o rodapé diz o mesmo em texto, então a cor nunca é o único sinal.
 */
function LinhaValorTri({ valor, delta }: { valor: number; delta: number | null }) {
  const noCorte = valor >= PROFICIENCIA_MINIMA;
  return (
    <div className="flex min-w-0 flex-wrap items-baseline" style={{ gap: 9, rowGap: 6 }}>
      <span data-testid="kpi-valor" className="tabular-nums"
        style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.035em', lineHeight: '36px', color: noCorte ? 'var(--gp-success-on)' : 'var(--gp-text-1)' }}>
        {formatNumero(valor)}
      </span>
      <span data-testid="kpi-sufixo" className="tabular-nums" style={{ fontSize: 13, color: 'var(--gp-text-3)' }}>/ 100</span>
      {delta !== null ? (
        <span data-testid="kpi-delta" className="ml-auto inline-flex min-w-0 max-w-full">
          <TagDelta valor={delta} sufixo=" vs anterior" densidade="kpi" className="max-w-full overflow-hidden text-ellipsis" />
        </span>
      ) : null}
    </div>
  );
}

export interface ProjecaoEnamedProps {
  visao: VisaoGeralB2b;
  meta: Meta;
  /** Ordem do simulado mais recente do período (referência dos indicadores). */
  ordemReferencia: number | null;
}

/** Bloco "Projeção para o ENAMED" (D7: separado dos resultados observados). */
export function ProjecaoEnamed({ visao, meta, ordemReferencia }: ProjecaoEnamedProps) {
  const id = useId();
  const [glossario, setGlossario] = useState(false);
  const { conceitoEnamed: conceito, triProjetado: tri } = visao;
  const proximo = proximoConceito(visao);
  const deltaConceito = deltaValido(conceito);
  const faltam = tri.valor === null ? null : calcularVariacao(tri.valor, PROFICIENCIA_MINIMA);
  const rodapeConceito = visao.proficientesPct.valor === null
    ? null
    : `${formatPct(visao.proficientesPct.valor)} de proficientes no ${ordinal(ordemReferencia)} simulado`;

  return (
    <section aria-labelledby={`${id}-titulo`} className="min-w-0 rounded-xl border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)]">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-5 pt-4">
        <h2 id={`${id}-titulo`} className="m-0 text-[15px] font-semibold">Projeção para o ENAMED</h2>
        <span className="text-xs text-[var(--gp-text-2)]">estimativa · não é resultado oficial do INEP</span>
        <button type="button" aria-expanded={glossario} aria-controls={glossario ? `${id}-glossario` : undefined} onClick={() => setGlossario((g) => !g)}
          className={`ml-auto inline-flex min-h-11 min-[600px]:min-h-0 items-center gap-1 whitespace-nowrap rounded-sm text-[13px] font-semibold text-[var(--gp-brand)] ${FOCO}`}>
          <Icon name="info" size={14} />Entenda as métricas
        </button>
      </div>
      <div className="grid gap-4 p-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <KpiCard testId="kpi-conceito-enamed" titulo="Conceito ENAMED previsto" hint="projeção institucional · escala 1 a 5" badge="projetado"
          meta={meta} estado={conceito.valor === null ? 'empty' : 'ok'}
          valor={conceito.valor === null ? TRACO : String(Math.round(conceito.valor))} sufixo="/ 5"
          // Protótipo: conceito igual ao anterior não mostra delta (escala inteira 1–5).
          delta={deltaConceito === 0 ? null : deltaConceito}
          serie={regua3(conceito.serie)} formatarPonto={(v) => (v === null ? TRACO : String(Math.round(v)))}
          rodape={rodapeConceito || proximo ? <>
            {rodapeConceito}
            {proximo ? <>{rodapeConceito ? <br /> : null}faltam {proximo.alunos} alunos para o conceito {proximo.conceito}</> : null}
          </> : undefined} />
        <KpiCard testId="kpi-tri-projetado" titulo="TRI projetado" hint="proficiência média · escala 0 a 100" badge="projetado"
          meta={meta} estado={tri.valor === null ? 'empty' : 'ok'} valor={formatNumero(tri.valor)} sufixo="/ 100"
          corpo={tri.valor === null ? undefined : <LinhaValorTri valor={tri.valor} delta={deltaValido(tri)} />}
          serie={regua3(tri.serie)} formatarPonto={formatNumero}
          rodape={faltam === null ? undefined : faltam > 0 ? `faltam ${formatNumero(faltam)} para ${PROFICIENCIA_MINIMA}` : `média da turma no corte de proficiente (${PROFICIENCIA_MINIMA}) ou acima`} />
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--gp-border-subtle)] p-[18px]">
          <span className="text-[13.5px] font-semibold">Evolução da proficiência média</span>
          <span className="text-xs text-[var(--gp-text-3)]">tracejado = proficiente ({PROFICIENCIA_MINIMA})</span>
          {pontosValidos(tri.serie).length ? <GraficoProficiencia serie={tri.serie} />
            : <span className="text-[13px] text-[var(--gp-text-2)]">Sem proficiência no período.</span>}
        </div>
      </div>
      {glossario ? (
        <dl id={`${id}-glossario`} className="m-0 grid gap-x-6 gap-y-3 rounded-b-xl border-t border-[var(--gp-border-subtle)] bg-[var(--gp-surface-2)] px-5 py-3.5 text-[12.5px]"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {GLOSSARIO.map((g) => (
            <div key={g.termo}>
              <dt className="font-semibold">{g.termo}</dt>
              <dd className="m-0 mt-0.5 text-[var(--gp-text-2)]">{g.definicao}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
