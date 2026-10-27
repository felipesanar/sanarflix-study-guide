import * as React from 'react';
import {
  DATA_MINIMA,
  calcularPeriodo,
  hojeSaoPaulo,
  rotuloSemestreLetivo,
  type OpcaoPeriodo,
} from '@/features/gestor/lib/engajamento';
import type { FiltrosEngajamento } from '@/features/gestor/hooks/useFiltrosEngajamento';

/**
 * Aparência de um controle de filtro do Engajamento (select, input de data e
 * botão): só tokens do tema do gestor, nenhum literal de cor (spec §13).
 */
export const ESTILO_CONTROLE: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  borderRadius: 'var(--gp-radius-sm)',
  border: '1px solid var(--gp-border-input)',
  background: 'var(--gp-surface-1)',
  color: 'var(--gp-text-1)',
  fontSize: 'var(--gp-font-size-body)',
};

export const ESTILO_ROTULO_FILTRO: React.CSSProperties = {
  fontSize: 'var(--gp-font-size-label)',
  fontWeight: 600,
  color: 'var(--gp-text-3)',
};

type FiltrosPeriodo = Pick<FiltrosEngajamento, 'periodo' | 'de' | 'ate' | 'setPeriodo'>;

/**
 * Filtro "Período" (spec §12.1): Últimos 6 meses, Últimos 3 meses, Últimos 30 dias, Semestre
 * letivo AAAA.S e Personalizado….
 *
 * Em "Personalizado…" aparecem dois campos de data ("De" e "Até") e o botão
 * "Aplicar". Escolher "Personalizado…" só abre os campos — a URL (e portanto o
 * recorte da tela) só muda no "Aplicar", com datas válidas: o mesmo critério da
 * RPC (mínimo 2025-01-01, no máximo hoje, `de ≤ ate`, até 731 dias).
 */
export function FiltroPeriodo({ filtros }: { filtros: FiltrosPeriodo }) {
  const id = React.useId();
  const hoje = hojeSaoPaulo();
  const { periodo, de: deUrl, ate: ateUrl, setPeriodo } = filtros;

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
    setPeriodo(valor as OpcaoPeriodo);
  };

  const datasValidas = calcularPeriodo('custom', hoje, de, ate).opcaoEfetiva === 'custom';

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-periodo`} style={ESTILO_ROTULO_FILTRO}>
          Período
        </label>
        <select
          id={`${id}-periodo`}
          value={modoPersonalizado ? 'custom' : periodo}
          onChange={(e) => aoEscolher(e.target.value)}
          style={ESTILO_CONTROLE}
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
            <label htmlFor={`${id}-de`} style={ESTILO_ROTULO_FILTRO}>
              De
            </label>
            <input
              id={`${id}-de`}
              type="date"
              min={DATA_MINIMA}
              max={hoje}
              value={de}
              onChange={(e) => setDe(e.target.value)}
              style={ESTILO_CONTROLE}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-ate`} style={ESTILO_ROTULO_FILTRO}>
              Até
            </label>
            <input
              id={`${id}-ate`}
              type="date"
              min={DATA_MINIMA}
              max={hoje}
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              style={ESTILO_CONTROLE}
            />
          </div>
          <button
            type="button"
            disabled={!datasValidas}
            onClick={() => setPeriodo('custom', de, ate)}
            className="disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              ...ESTILO_CONTROLE,
              background: 'var(--gp-brand)',
              borderColor: 'var(--gp-brand)',
              color: 'var(--gp-on-brand)',
              fontWeight: 600,
            }}
          >
            Aplicar
          </button>
        </>
      ) : null}
    </div>
  );
}
