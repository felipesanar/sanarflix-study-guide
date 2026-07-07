import * as React from 'react';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GestorPanel, MetricValue } from '@/experiences/gestor/ui';
import type { HeaderSummary } from '@/types/desempenhoV2';
import type { TemaPrioridade } from './priorizacao';

interface SimuladorImpactoProps {
  temas: TemaPrioridade[];
  headerSummary: HeaderSummary;
}

const CONCEITO_PROFICIENTE_MIN = 60;

function conceitoFromPercent(percent: number): number {
  if (percent >= 90) return 5;
  if (percent >= 75) return 4;
  if (percent >= 60) return 3;
  if (percent >= 40) return 2;
  return 1;
}

const CONCEITO_COLOR: Record<number, string> = {
  1: 'text-red-600 dark:text-red-400',
  2: 'text-red-600 dark:text-red-400',
  3: 'text-amber-600 dark:text-amber-400',
  4: 'text-blue-600 dark:text-blue-400',
  5: 'text-emerald-600 dark:text-emerald-400',
};

/**
 * Simulador de impacto (HIPOTÉTICO) — projeção linear simplificada e
 * transparente, calculada 100% no cliente:
 *
 *   1. peso do tema no exame = questões_do_tema / total_de_questões
 *   2. ganho no score geral  = melhoria_simulada(pp) × peso_do_tema
 *   3. novos proficientes    = alunos_abaixo_da_proficiência cujo score projetado
 *                              (score_atual + ganho) cruza o limiar de 60%
 *
 * O modelo assume que a melhoria no tema se propaga proporcionalmente ao
 * score geral do aluno (mesma premissa do antigo SimuladorImpactoModule) —
 * não é uma previsão garantida, apenas uma referência de ordem de grandeza.
 */
export const SimuladorImpacto: React.FC<SimuladorImpactoProps> = ({ temas, headerSummary }) => {
  const [temaId, setTemaId] = React.useState(temas[0]?.id ?? '');
  const [melhoria, setMelhoria] = React.useState(10);

  const temaAlvo = React.useMemo(
    () => temas.find((t) => t.id === temaId) ?? temas[0] ?? null,
    [temas, temaId],
  );

  const totalAlunos = headerSummary.totalAlunos ?? 0;
  const pcpAtual = headerSummary.percentProficientes ?? 0;

  const resultado = React.useMemo(() => {
    if (!temaAlvo || totalAlunos <= 0) return null;

    const pesoNoExame = temaAlvo.prevalencia / 100;
    const ganhoNoScoreGeral = melhoria * pesoNoExame;

    // Proporção de alunos abaixo da proficiência que, com o ganho projetado,
    // cruzariam o limiar de 60% — aproximação linear sobre a distribuição
    // atual (mesma lógica de "gap até o limiar" do simulador anterior).
    const alunosAbaixoAtual = Math.max(0, totalAlunos - Math.round((totalAlunos * pcpAtual) / 100));
    const fracaoQueCruza = Math.min(1, ganhoNoScoreGeral / Math.max(1, 100 - pcpAtual)) * 0.6;
    const novosProficientes = Math.min(alunosAbaixoAtual, Math.round(alunosAbaixoAtual * fracaoQueCruza));

    const proficientesAtuais = Math.round((totalAlunos * pcpAtual) / 100);
    const proficientesProjetados = Math.min(totalAlunos, proficientesAtuais + novosProficientes);
    const pcpProjetado = Math.min(100, Math.round(((proficientesProjetados / totalAlunos) * 100) * 10) / 10);

    const conceitoAtual = conceitoFromPercent(pcpAtual);
    const conceitoProjetado = conceitoFromPercent(pcpProjetado);

    return {
      pesoNoExame,
      ganhoNoScoreGeral,
      novosProficientes,
      pcpAtual,
      pcpProjetado,
      conceitoAtual,
      conceitoProjetado,
    };
  }, [temaAlvo, melhoria, totalAlunos, pcpAtual]);

  if (temas.length === 0 || !temaAlvo) {
    return null;
  }

  const saindoDaSancao = (resultado?.conceitoAtual ?? 0) < 3 && (resultado?.conceitoProjetado ?? 0) >= 3;

  return (
    <GestorPanel
      title="Simulador de impacto"
      subtitle="Projeção linear simplificada — quanto uma melhoria no tema-alvo pode gerar em proficientes"
      action={
        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
          HIPOTÉTICO
        </Badge>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tema-alvo</label>
            <Select value={temaAlvo.id} onValueChange={setTemaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um tema" />
              </SelectTrigger>
              <SelectContent>
                {temas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.tema} ({t.acerto.toFixed(0)}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground truncate">{temaAlvo.area} · {temaAlvo.especialidade}</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Melhoria simulada</label>
              <Badge variant="outline" className="text-xs font-mono">+{melhoria}pp</Badge>
            </div>
            <Slider
              value={[melhoria]}
              onValueChange={([v]) => setMelhoria(v)}
              min={1}
              max={30}
              step={1}
              className="mt-2.5"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>+1pp</span>
              <span>+30pp</span>
            </div>
          </div>
        </div>

        {resultado && (
          <>
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-5 text-center space-y-1">
              <MetricValue size="xl" className="text-primary block">
                +{resultado.novosProficientes}
              </MetricValue>
              <p className="text-sm font-medium text-foreground">
                {resultado.novosProficientes === 1 ? 'aluno se torna proficiente' : 'alunos se tornam proficientes'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card px-3 py-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Δ proficientes</p>
                <p className="font-mono tabular-nums text-lg font-bold text-foreground flex items-center justify-center gap-1.5">
                  <span>{resultado.pcpAtual.toFixed(1)}%</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-emerald-600 dark:text-emerald-400">{resultado.pcpProjetado.toFixed(1)}%</span>
                </p>
              </div>
              <div className="rounded-lg border bg-card px-3 py-3 text-center space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Conceito</p>
                <p className="font-mono tabular-nums text-lg font-bold flex items-center justify-center gap-1.5">
                  <span className={CONCEITO_COLOR[resultado.conceitoAtual]}>{resultado.conceitoAtual}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <span className={CONCEITO_COLOR[resultado.conceitoProjetado]}>{resultado.conceitoProjetado}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {resultado.conceitoProjetado >= 3
                    ? saindoDaSancao
                      ? 'sai da sanção'
                      : 'sem sanção'
                    : 'ainda em sanção'}
                </p>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <FlaskConical className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Projeção linear simplificada: melhoria no tema ({melhoria}pp) × peso do tema no exame
              ({(resultado.pesoNoExame * 100).toFixed(1)}%) = +{resultado.ganhoNoScoreGeral.toFixed(1)}pts no score geral,
              aplicado proporcionalmente sobre os alunos abaixo de {CONCEITO_PROFICIENTE_MIN}%. Não é uma previsão
              garantida — use como referência de ordem de grandeza.
            </p>
          </>
        )}
      </div>
    </GestorPanel>
  );
};
