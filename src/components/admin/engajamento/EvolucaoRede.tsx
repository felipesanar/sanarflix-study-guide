import * as React from 'react';
import { cn } from '@/lib/utils';
import { FiguraGrafico } from '@/features/gestor/components/engajamento/FiguraGrafico';
import { eixoPct, eixoQuantidade } from '@/features/gestor/components/engajamento/LinhaMensal';
import { diaMes, mesCurto, mesExtenso } from '@/features/gestor/lib/engajamento';
import { formatNumero, formatPct, TRACO } from '@/features/gestor/lib/formatters';
import type { AdminEngajamento } from '@/features/gestor/api/types-engajamento';

export interface EvolucaoRedeProps {
  meses: AdminEngajamento['meses'];
  semestres: AdminEngajamento['semestres'];
  /** `fim` do período, para "parcial, até dd/mm". */
  fim: string;
  /** Semestre filtrado (`sem`). */
  semestre: number | null;
  /** Clicar num semestre filtra a página (toggle): grava/limpa `sem` na URL. */
  onSemestre: (n: number | null) => void;
}

type Indicador = 'questoes' | 'acerto' | 'conteudos' | 'videos' | 'documentos';

const INDICADORES: Array<{ id: Indicador; opcao: string; nome: string; descMes: string; descSemestre: string }> = [
  { id: 'questoes', opcao: 'Questões', nome: 'Questões resolvidas', descMes: 'Total de questões resolvidas na rede', descSemestre: 'Total resolvido por alunos de cada semestre' },
  { id: 'acerto', opcao: '% de acerto', nome: '% de acerto', descMes: 'Acerto médio da rede', descSemestre: 'Acerto médio por semestre (barra cheia = 100%)' },
  { id: 'conteudos', opcao: 'Conteúdos', nome: 'Conteúdos consumidos', descMes: 'Vídeos + documentos abertos na rede', descSemestre: 'Vídeos + documentos abertos por alunos de cada semestre' },
  { id: 'videos', opcao: 'Vídeos', nome: 'Vídeos', descMes: 'Vídeos abertos na rede', descSemestre: 'Vídeos abertos por alunos de cada semestre' },
  { id: 'documentos', opcao: 'Documentos', nome: 'Documentos', descMes: 'Documentos abertos na rede', descSemestre: 'Documentos abertos por alunos de cada semestre' },
];

const LARGURA = 1000;
const ALTURA = 200;
const ALTURA_BARRAS = 140;

const pctInteiro = (v: number) => `${Math.round(v)}%`;

/** Múltiplo do teto do eixo de quantidade (§10.6): 1.000 para questões, 500 para conteúdos. */
const passoDe = (i: Indicador): 500 | 1000 => (i === 'questoes' ? 1000 : 500);

function LinhaRede({
  rotulo,
  pontos,
  pct,
  passo,
}: {
  rotulo: string;
  pontos: Array<{ mes: string; parcial: boolean; valor: number | null }>;
  pct: boolean;
  passo: 500 | 1000;
}) {
  const valores = pontos.map((p) => p.valor);
  const eixo = pct ? eixoPct(valores) : eixoQuantidade(valores, passo);
  const n = pontos.length;
  const formatar = pct ? pctInteiro : formatNumero;
  const x = (i: number) => (i + 0.5) / n;
  const y = (v: number) => 1 - (v - eixo.min) / (eixo.max - eixo.min);

  const trechos: Array<Array<{ i: number; v: number }>> = [[]];
  pontos.forEach((p, i) => {
    if (p.valor === null) trechos.push([]);
    else trechos[trechos.length - 1].push({ i, v: p.valor });
  });
  const ticks = [eixo.max, (eixo.min + eixo.max) / 2, eixo.min];

  return (
    <FiguraGrafico
      rotulo={rotulo}
      cabecalho={['Mês', 'Valor']}
      linhasTabela={pontos.map((p) => ({ rotulo: mesCurto(p.mes, p.parcial), valor: p.valor === null ? TRACO : formatar(p.valor) }))}
    >
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(n * 36, 280) + 56 }}>
          <div className="grid gap-x-1" style={{ gridTemplateColumns: '52px 1fr' }}>
            <div className="relative" style={{ height: ALTURA }}>
              {ticks.map((t, i) => (
                <span key={i} className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground" style={{ top: `${y(t) * 100}%` }}>
                  {formatar(Math.round(t))}
                </span>
              ))}
            </div>
            <div className="relative" style={{ height: ALTURA }}>
              <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true" focusable="false">
                {ticks.map((t, i) => (
                  <line key={i} x1={0} x2={LARGURA} y1={y(t) * ALTURA} y2={y(t) * ALTURA} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ))}
                {trechos
                  .filter((t) => t.length > 1)
                  .map((t, k) => (
                    <React.Fragment key={k}>
                      <polygon
                        data-testid="rede-area"
                        points={`${x(t[0].i) * LARGURA},${ALTURA} ${t.map((p) => `${x(p.i) * LARGURA},${y(p.v) * ALTURA}`).join(' ')} ${x(t[t.length - 1].i) * LARGURA},${ALTURA}`}
                        className="fill-primary"
                        fillOpacity={0.08}
                      />
                      <polyline
                        data-testid="rede-serie"
                        points={t.map((p) => `${x(p.i) * LARGURA},${y(p.v) * ALTURA}`).join(' ')}
                        fill="none"
                        className="stroke-primary"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </React.Fragment>
                  ))}
              </svg>
              {pontos.map((p, i) =>
                p.valor === null ? null : (
                  <span
                    key={p.mes}
                    data-testid="rede-ponto"
                    data-parcial={p.parcial ? 'true' : 'false'}
                    className={cn('absolute block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary', p.parcial ? 'bg-background' : 'bg-primary')}
                    style={{ left: `${x(i) * 100}%`, top: `${y(p.valor) * 100}%` }}
                  />
                ),
              )}
            </div>
            <span />
            <div className="flex">
              {pontos.map((p) => (
                <span key={p.mes} className="mt-1 flex-1 text-center text-[11px] font-medium text-muted-foreground">
                  {mesCurto(p.mes, p.parcial)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FiguraGrafico>
  );
}

function BarrasSemestreRede({
  rotulo,
  linhas,
  pct,
  selecionado,
  onSelecionar,
}: {
  rotulo: string;
  linhas: Array<{ semestre: number; valor: number | null }>;
  pct: boolean;
  selecionado: number | null;
  onSelecionar: (n: number) => void;
}) {
  const maximo = pct ? 100 : linhas.reduce((m, l) => Math.max(m, l.valor ?? 0), 0);
  const texto = (v: number | null) => (v === null ? TRACO : pct ? formatPct(v) : formatNumero(v));

  return (
    <FiguraGrafico
      rotulo={rotulo}
      cabecalho={['Semestre', 'Valor']}
      linhasTabela={linhas.map((l) => ({ rotulo: `${l.semestre}º semestre`, valor: texto(l.valor) }))}
    >
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1" style={{ minWidth: linhas.length * 34 }}>
          {linhas.map((l) => {
            const ativo = selecionado === l.semestre;
            const altura = maximo > 0 && (l.valor ?? 0) > 0 ? Math.max(2, Math.round(((l.valor ?? 0) / maximo) * ALTURA_BARRAS)) : 0;
            return (
              <button
                key={l.semestre}
                type="button"
                aria-pressed={ativo}
                aria-label={`${l.semestre}º semestre: ${texto(l.valor)}`}
                onClick={() => onSelecionar(l.semestre)}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center rounded-md border px-0.5 py-1',
                  ativo ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:bg-muted/50',
                )}
              >
                <span className="text-[10px] font-medium tabular-nums text-foreground">{texto(l.valor)}</span>
                <span className="flex w-full items-end justify-center" style={{ height: ALTURA_BARRAS }}>
                  <span
                    data-testid="rede-barra-semestre"
                    className={cn('block w-[70%] max-w-8 rounded-t-sm bg-primary', selecionado !== null && !ativo && 'bg-primary/45')}
                    style={{ height: altura }}
                  />
                </span>
                <span className="mt-1 text-[11px] font-medium text-muted-foreground">{l.semestre}º</span>
              </button>
            );
          })}
        </div>
      </div>
    </FiguraGrafico>
  );
}

/**
 * "Evolução da rede" (spec §12.5): um indicador por vez (Questões, % de acerto,
 * Conteúdos, Vídeos, Documentos), mês a mês e por semestre. As barras por semestre
 * são botões que filtram a página (`sem` na URL, toggle), sincronizados com o `<select>`.
 */
export function EvolucaoRede({ meses, semestres, fim, semestre, onSemestre }: EvolucaoRedeProps) {
  const [indicador, setIndicador] = React.useState<Indicador>('questoes');
  const info = INDICADORES.find((i) => i.id === indicador) ?? INDICADORES[0];
  const pct = indicador === 'acerto';

  const valorMes = (m: AdminEngajamento['meses'][number]) =>
    indicador === 'questoes' ? m.questoes : indicador === 'acerto' ? m.acertoPct : indicador === 'conteudos' ? m.conteudos : indicador === 'videos' ? m.videos : m.documentos;
  const valorSem = (s: AdminEngajamento['semestres'][number]) =>
    indicador === 'questoes' ? s.questoes : indicador === 'acerto' ? s.acertoPct : indicador === 'conteudos' ? s.conteudos : indicador === 'videos' ? s.videos : s.documentos;

  const ultimo = meses[meses.length - 1];
  const eixo = eixoPct(meses.map((m) => m.acertoPct));
  const descMes =
    (pct ? `${info.descMes} (eixo de ${eixo.min}% a ${eixo.max}%)` : info.descMes) +
    (semestre !== null ? ` · só ${semestre}º semestre` : '') +
    (ultimo?.parcial ? ` · ${mesExtenso(ultimo.mes).toLowerCase()} parcial, até ${diaMes(fim)}` : '');

  return (
    <section aria-labelledby="titulo-evolucao-rede" className="min-w-0 max-w-full rounded-xl border bg-card p-4" data-testid="evolucao-rede">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="titulo-evolucao-rede" className="text-base font-semibold">
            Evolução da rede
          </h2>
          <p className="text-xs text-muted-foreground">Escolha o indicador · o gráfico ao lado mostra o mesmo indicador por semestre</p>
        </div>
        <select
          aria-label="Indicador"
          value={indicador}
          onChange={(e) => setIndicador(e.target.value as Indicador)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {INDICADORES.map((i) => (
            <option key={i.id} value={i.id}>
              {i.opcao}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div data-testid="evolucao-mensal" className="min-w-0">
          <h3 className="text-sm font-semibold">{info.nome} por mês</h3>
          <p className="mb-2 text-xs text-muted-foreground">{descMes}</p>
          <LinhaRede
            rotulo={`${info.nome} por mês`}
            pct={pct}
            passo={passoDe(indicador)}
            pontos={meses.map((m) => ({ mes: m.mes, parcial: m.parcial, valor: valorMes(m) }))}
          />
        </div>
        <div data-testid="evolucao-semestre" className="min-w-0">
          <h3 className="text-sm font-semibold">{info.nome} por semestre</h3>
          <p className="mb-2 text-xs text-muted-foreground">{info.descSemestre} · clique num semestre para filtrar a página</p>
          <BarrasSemestreRede
            rotulo={`${info.nome} por semestre`}
            pct={pct}
            selecionado={semestre}
            onSelecionar={(n) => onSemestre(semestre === n ? null : n)}
            linhas={semestres.map((s) => ({ semestre: s.semestre, valor: valorSem(s) }))}
          />
        </div>
      </div>
    </section>
  );
}
