import type { PontoSerie } from '@/features/gestor/api/types';
import { formatNumero } from '@/features/gestor/lib/formatters';
import { PROFICIENCIA_MINIMA } from '@/features/gestor/lib/regras';

const LARGURA = 300;
const ALTURA = 124;
const X0 = 40;
const X1 = 280;
const Y_TOPO = 20;
const Y_BASE = 100;

/**
 * Evolução da proficiência média (docs/03 § Tela 2): linha de marca de 2px, pontos brancos de raio 3.5,
 * rótulo acima de cada ponto, eixo 1º…Nº e o tracejado no corte de proficiente. SVG simples, máx. 420px.
 * Ponto `null` não vira zero: fica sem marcador e interrompe a linha.
 */
export function GraficoProficiencia({ serie, corte = PROFICIENCIA_MINIMA }: { serie: PontoSerie[]; corte?: number }) {
  const valores = serie.map((p) => p.valor).filter((v): v is number => v !== null);
  const min = Math.floor(Math.min(corte, ...valores) - 3);
  const max = Math.ceil(Math.max(corte, ...valores) + 3);
  const y = (v: number) => Y_BASE - ((v - min) / (max - min)) * (Y_BASE - Y_TOPO);
  const x = (i: number) => (serie.length === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (serie.length - 1));
  const segmentos: string[] = [];
  serie.forEach((p, i) => {
    const ant = serie[i - 1];
    if (i > 0 && p.valor !== null && ant?.valor !== null && ant !== undefined) {
      segmentos.push(`${x(i - 1)},${y(ant.valor as number)} ${x(i)},${y(p.valor)}`);
    }
  });
  const rotulo = `Proficiência média por simulado: ${serie.map((p) => formatNumero(p.valor)).join(', ')}`;
  return (
    <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={rotulo} className="h-auto w-full" style={{ maxWidth: 420 }}>
      <line x1={24} x2={292} y1={y(corte)} y2={y(corte)} strokeDasharray="4 4" style={{ stroke: 'var(--gp-border-input)' }} />
      <text x={0} y={y(corte) + 4} fontSize={11} style={{ fill: 'var(--gp-text-3)' }}>{corte}</text>
      {segmentos.map((pts) => (
        <polyline key={pts} points={pts} fill="none" strokeWidth={2} style={{ stroke: 'var(--gp-brand)' }} />
      ))}
      {serie.map((p, i) => (
        <g key={`${p.rotulo}-${i}`}>
          {p.valor !== null ? <>
            <circle cx={x(i)} cy={y(p.valor)} r={3.5} strokeWidth={2} style={{ fill: 'var(--gp-surface-1)', stroke: 'var(--gp-brand)' }} />
            <text x={x(i)} y={y(p.valor) - 9} fontSize={12} fontWeight={600} textAnchor="middle" style={{ fill: 'var(--gp-text-1)' }}>
              {formatNumero(p.valor)}
            </text>
          </> : null}
          <text x={x(i)} y={120} fontSize={11} textAnchor="middle" style={{ fill: 'var(--gp-text-3)' }}>{p.rotulo}</text>
        </g>
      ))}
    </svg>
  );
}
