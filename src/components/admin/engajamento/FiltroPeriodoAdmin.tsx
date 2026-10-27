import * as React from 'react';
import {
  DATA_MINIMA,
  calcularPeriodo,
  hojeSaoPaulo,
  rotuloSemestreLetivo,
  type OpcaoPeriodo,
} from '@/features/gestor/lib/engajamento';

const CONTROLE =
  'h-9 rounded-md border border-border bg-background px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ROTULO = 'text-xs font-semibold text-muted-foreground';

export interface FiltroPeriodoAdminProps {
  /** Opção em vigor (`3m`, `6m`, `30d`, `letivo`, `custom`). */
  periodo: OpcaoPeriodo;
  /** Datas gravadas na URL; só valem em `custom`. */
  de: string | null;
  ate: string | null;
  onChange: (periodo: OpcaoPeriodo, de?: string, ate?: string) => void;
}

/**
 * Filtro "Período" do console admin: as mesmas opções do portal do gestor (Últimos 6 meses,
 * Últimos 3 meses, Últimos 30 dias, Semestre letivo AAAA.S e Personalizado…), com o visual
 * do console. "Personalizado…" só abre os campos De e Até; a URL (e a consulta) só muda no
 * "Aplicar", com datas válidas pelo mesmo critério da RPC (mínimo 2025-01-01, no máximo hoje,
 * `de ≤ ate`, até 731 dias).
 */
export function FiltroPeriodoAdmin({ periodo, de: deUrl, ate: ateUrl, onChange }: FiltroPeriodoAdminProps) {
  const id = React.useId();
  const hoje = hojeSaoPaulo();

  const [modoPersonalizado, setModoPersonalizado] = React.useState(periodo === 'custom');
  const [de, setDe] = React.useState(deUrl ?? '');
  const [ate, setAte] = React.useState(ateUrl ?? '');

  // A URL é a fonte: voltar/avançar no histórico ou colar um link reabre/fecha os campos.
  React.useEffect(() => {
    setModoPersonalizado(periodo === 'custom');
    if (periodo === 'custom') {
      setDe(deUrl ?? '');
      setAte(ateUrl ?? '');
    }
  }, [periodo, deUrl, ateUrl]);

  const aoEscolher = (valor: string) => {
    if (valor === 'custom') {
      setModoPersonalizado(true);
      return;
    }
    setModoPersonalizado(false);
    onChange(valor as OpcaoPeriodo);
  };

  const datasValidas = calcularPeriodo('custom', hoje, de, ate).opcaoEfetiva === 'custom';

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-periodo`} className={ROTULO}>
          Período
        </label>
        <select
          id={`${id}-periodo`}
          value={modoPersonalizado ? 'custom' : periodo}
          onChange={(e) => aoEscolher(e.target.value)}
          className={CONTROLE}
        >
          <option value="6m">Últimos 6 meses</option>
          <option value="3m">Últimos 3 meses</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="letivo">{rotuloSemestreLetivo(hoje)}</option>
          <option value="custom">Personalizado…</option>
        </select>
      </div>

      {modoPersonalizado ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-de`} className={ROTULO}>
              De
            </label>
            <input id={`${id}-de`} type="date" min={DATA_MINIMA} max={hoje} value={de} onChange={(e) => setDe(e.target.value)} className={CONTROLE} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-ate`} className={ROTULO}>
              Até
            </label>
            <input id={`${id}-ate`} type="date" min={DATA_MINIMA} max={hoje} value={ate} onChange={(e) => setAte(e.target.value)} className={CONTROLE} />
          </div>
          <button
            type="button"
            disabled={!datasValidas}
            onClick={() => onChange('custom', de, ate)}
            className={`${CONTROLE} border-primary bg-primary font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Aplicar
          </button>
        </>
      ) : null}
    </div>
  );
}
