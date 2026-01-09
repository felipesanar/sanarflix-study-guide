import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface LiveChartProps {
  data: { minuto: string; count: number }[];
  height?: number;
}

export const LiveChart = ({ data, height = 200 }: LiveChartProps) => {
  // Generate placeholder data if we don't have enough points
  const chartData = useMemo(() => {
    if (data.length === 0) {
      // Generate last 10 minutes with 0 values
      const now = new Date();
      return Array.from({ length: 10 }, (_, i) => {
        const d = new Date(now.getTime() - (9 - i) * 60 * 1000);
        return {
          minuto: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          count: 0,
        };
      });
    }
    return data.slice(-20); // Show last 20 data points
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
        <XAxis
          dataKey="minuto"
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              return (
                <div className="bg-popover border rounded-lg p-2 shadow-lg">
                  <p className="text-xs text-muted-foreground">{payload[0].payload.minuto}</p>
                  <p className="text-sm font-semibold">
                    {payload[0].value} resposta{Number(payload[0].value) !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            }
            return null;
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#colorCount)"
          animationDuration={300}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
