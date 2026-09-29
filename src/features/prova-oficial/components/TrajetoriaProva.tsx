import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { ProvaOficialAluno } from '../types';

interface TrajetoriaProvaProps {
  pontos: ProvaOficialAluno['trajetoria'];
}

const LEGENDA = 'Os simulados são provas diferentes; o que vale ler aqui é a tendência.';

/**
 * Ponto da prova oficial destacado no gráfico de tendência — o aluno nunca
 * deve ler isso como "nota", só como evolução relativa (spec D3).
 */
const DotDaTrajetoria = (props: unknown) => {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { prova: boolean } };
  if (payload.prova) {
    return <circle cx={cx} cy={cy} r={7} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill="hsl(var(--primary) / 0.5)" />;
};

export const TrajetoriaProva = ({ pontos }: TrajetoriaProvaProps) => {
  const provaPonto = pontos.find((p) => p.provaOficial) ?? pontos[pontos.length - 1];

  if (pontos.length < 2) {
    return (
      <section className="space-y-2">
        <h2 className="text-base font-bold tracking-tight">Sua trajetória</h2>
        {provaPonto && (
          <p className="text-2xl font-bold text-primary tabular-nums">{provaPonto.acertoPct ?? 0}%</p>
        )}
        <p className="text-xs text-muted-foreground">{LEGENDA}</p>
      </section>
    );
  }

  const dados = pontos.map((p) => ({ nome: p.nome, acertoPct: p.acertoPct ?? 0, prova: p.provaOficial }));

  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold tracking-tight">Sua trajetória</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={50}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              width={36}
            />
            <RechartsTooltip formatter={(value: number) => [`${value}%`, 'Acertos']} />
            <Line
              type="monotone"
              dataKey="acertoPct"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={DotDaTrajetoria}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">{LEGENDA}</p>
    </section>
  );
};
