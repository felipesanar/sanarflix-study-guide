/**
 * Indicadores do Detalhamento por modalidade — usa o KpiCard REAL do Gestor.
 * Referência: capturas/b2c/08-detalhamento.png e capturas/b2b/07-detalhamento.png.
 *
 * Os protótipos desenham o cartão com valor 34px; em produção vale o KpiCard
 * (valor 44/800, título 14/700, hint 11px, padding 18, gap 14, régua com
 * fundo --gp-brand-surface na célula atual). "projetado" usa `badge`, que
 * renderiza `Tag variant="qualificador"`.
 */
import * as React from 'react';
import { KpiCard } from '@/features/gestor/components/KpiCard';
import { calcularVariacao } from '@/features/gestor/lib/regras';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

export interface KpisDetalhamentoMentorProps {
  modalidade: 'b2c' | 'b2b';
  meta: Meta;
  estado: 'ok' | 'loading' | 'empty' | 'error';
  acertoMedio: number | null;
  participantes: number;
  /** Uma entrada por simulado selecionado, em ordem cronológica. */
  porSimulado: {
    rotulo: string; // "4º"
    participacao: number; // B2C
    possivelAprovacaoPct: number | null; // B2C (Metas, V1)
    conceito: number | null; // B2B
    proficienciaMedia: number | null; // B2B
    proficientesPct: number | null; // B2B
  }[];
  totalTurma: number;
  onTentarNovamente?: () => void;
}

export function KpisDetalhamentoMentor(p: KpisDetalhamentoMentorProps) {
  const ult = p.porSimulado[p.porSimulado.length - 1];
  const pen = p.porSimulado[p.porSimulado.length - 2];
  const serie = (k: 'possivelAprovacaoPct' | 'conceito' | 'proficienciaMedia'): PontoSerie[] =>
    p.porSimulado.map((s) => ({ rotulo: s.rotulo, valor: s[k] }) as PontoSerie);

  const comum = { meta: p.meta, estado: p.estado, onTentarNovamente: p.onTentarNovamente };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiCard
        {...comum}
        testId="kpi-acerto-medio"
        titulo="Percentual de acerto médio"
        hint="questões certas nos simulados do recorte"
        valor={formatPct(p.acertoMedio, 1)}
        valorNumerico={p.acertoMedio}
        formatarValor={(v) => formatPct(v, 1)}
        rodape={`${p.participantes} participantes`}
      />
      {p.modalidade === 'b2c' ? (
        <>
          <KpiCard
            {...comum}
            testId="kpi-possivel-aprovacao"
            titulo="Possível aprovação"
            hint="acima do corte da meta mais difícil"
            badge="V1"
            valor={formatPct(ult?.possivelAprovacaoPct ?? null)}
            delta={calcularVariacao(pen?.possivelAprovacaoPct ?? null, ult?.possivelAprovacaoPct ?? null)}
            serie={serie('possivelAprovacaoPct')}
            formatarPonto={(v) => formatPct(v)}
            rodape={p.porSimulado.length > 1 ? 'com 2+ simulados, comparativo entre eles' : 'selecione 2 simulados para comparar'}
          />
          <KpiCard
            {...comum}
            testId="kpi-participacao"
            titulo="Participação"
            hint={`fizeram o ${ult?.rotulo ?? ''} simulado`}
            valor={formatNumero(ult?.participacao ?? null)}
            sufixo={`/ ${p.totalTurma}`}
            densidadeSufixo="fracao"
            rodape={`${p.participantes} fizeram pelo menos um do recorte`}
          />
        </>
      ) : (
        <>
          <KpiCard
            {...comum}
            testId="kpi-conceito"
            titulo="Conceito ENAMED"
            hint="projeção institucional · escala 1 a 5"
            badge="projetado"
            valor={formatNumero(ult?.conceito ?? null)}
            sufixo="/ 5"
            delta={calcularVariacao(pen?.conceito ?? null, ult?.conceito ?? null)}
            serie={serie('conceito')}
            rodape={`${formatPct(ult?.proficientesPct ?? null)} de proficientes no ${ult?.rotulo ?? ''} simulado`}
          />
          <KpiCard
            {...comum}
            testId="kpi-tri-projetado"
            titulo="TRI projetado"
            hint="proficiência média · escala 0 a 100"
            badge="projetado"
            valor={formatNumero(ult?.proficienciaMedia ?? null)}
            valorNumerico={ult?.proficienciaMedia ?? null}
            formatarValor={formatNumero}
            sufixo="/ 100"
            delta={calcularVariacao(pen?.proficienciaMedia ?? null, ult?.proficienciaMedia ?? null)}
            serie={serie('proficienciaMedia')}
          />
        </>
      )}
    </div>
  );
}
