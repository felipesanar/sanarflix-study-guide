import { KpiCard } from '@/features/gestor/components/KpiCard';
import { calcularVariacao } from '@/features/gestor/lib/regras';
import { formatNumero, formatPct } from '@/features/gestor/lib/formatters';
import type { Meta, PontoSerie } from '@/features/gestor/api/types';

export interface KpisDetalhamentoMentorProps {
  modalidade: 'b2c' | 'b2b';
  meta: Meta;
  estado: 'ok' | 'loading' | 'empty' | 'error';
  acertoMedio: number | null;
  participantes: number | null;
  /** Uma entrada por simulado selecionado, em ordem cronológica. */
  porSimulado: {
    rotulo: string;
    participacao: number | null;
    possivelAprovacaoPct: number | null;
    conceito: number | null;
    proficienciaMedia: number | null;
    proficientesPct: number | null;
  }[];
  totalTurma: number | null;
  onTentarNovamente?: () => void;
}

export function KpisDetalhamentoMentor(p: KpisDetalhamentoMentorProps) {
  const ult = p.porSimulado[p.porSimulado.length - 1];
  const pen = p.porSimulado[p.porSimulado.length - 2];
  const serie = (k: 'possivelAprovacaoPct' | 'conceito' | 'proficienciaMedia'): PontoSerie[] => {
    const validos = p.porSimulado.map(s => ({ rotulo: s.rotulo, valor: s[k] })).filter(s => s.valor !== null);
    // KpiCard conta entradas, não pontos válidos. Proteção local sem alterar o Gestor.
    if (validos.length < 2) return [];
    return validos.length > 3 ? [validos[0], ...validos.slice(-2)] : validos;
  };
  const comum = { meta: p.meta, estado: p.estado, onTentarNovamente: p.onTentarNovamente };
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiCard {...comum} testId="kpi-acerto-medio" titulo="Percentual de acerto médio"
        hint="questões certas nos simulados do recorte" valor={formatPct(p.acertoMedio, 1)}
        valorNumerico={p.acertoMedio} formatarValor={v => formatPct(v, 1)}
        rodape={`${formatNumero(p.participantes)} participantes`} />
      {p.modalidade === 'b2c' ? <>
        <KpiCard {...comum} testId="kpi-possivel-aprovacao" titulo="Possível aprovação"
          hint="acima do corte da meta mais difícil" badge="V1"
          valor={formatPct(ult?.possivelAprovacaoPct ?? null)}
          delta={calcularVariacao(pen?.possivelAprovacaoPct ?? null, ult?.possivelAprovacaoPct ?? null)}
          serie={serie('possivelAprovacaoPct')} formatarPonto={v => formatPct(v)}
          rodape={p.porSimulado.length > 1 ? 'com 2+ simulados, comparativo entre eles' : 'selecione 2 simulados para comparar'} />
        <KpiCard {...comum} testId="kpi-participacao" titulo="Participação"
          hint={`fizeram o ${ult?.rotulo ?? '—'} simulado`} valor={formatNumero(ult?.participacao ?? null)}
          sufixo={`/ ${formatNumero(p.totalTurma)}`} densidadeSufixo="fracao"
          rodape={`${formatNumero(p.participantes)} fizeram pelo menos um do recorte`} />
      </> : <>
        <KpiCard {...comum} testId="kpi-conceito" titulo="Conceito ENAMED"
          hint="projeção institucional · escala 1 a 5" badge="projetado"
          valor={formatNumero(ult?.conceito ?? null)} sufixo="/ 5"
          delta={calcularVariacao(pen?.conceito ?? null, ult?.conceito ?? null)} serie={serie('conceito')}
          rodape={<>{formatPct(ult?.proficientesPct ?? null)} de proficientes no {ult?.rotulo ?? '—'} simulado<br />não é resultado oficial do INEP</>} />
        <KpiCard {...comum} testId="kpi-tri-projetado" titulo="TRI projetado"
          hint="proficiência média · escala 0 a 100" badge="projetado"
          valor={formatNumero(ult?.proficienciaMedia ?? null)} valorNumerico={ult?.proficienciaMedia ?? null}
          formatarValor={formatNumero} sufixo="/ 100"
          delta={calcularVariacao(pen?.proficienciaMedia ?? null, ult?.proficienciaMedia ?? null)} serie={serie('proficienciaMedia')} />
      </>}
    </div>
  );
}
