import * as React from 'react';
import { TRACO } from '@/features/gestor/lib/formatters';
import { alturaDaBarra, COR_BARRA_CLARA } from './BarrasMensais';
import { FiguraGrafico } from './FiguraGrafico';

export interface LinhaBarraSemestre {
  /** 1–12. */
  semestre: number;
  /** `null` = sem dado (barra vazia). */
  valor: number | null;
  /** Texto acima da barra, já formatado ("14", "61%", "—"). */
  texto: string;
}

export interface BarrasPorSemestreProps {
  /** Nome acessível da figura. */
  rotulo: string;
  /** Uma linha por semestre, do 1º ao 12º (P8); quem chama decide quais mostrar (ex.: só os da IES). */
  linhas: LinhaBarraSemestre[];
  /**
   * `quantidade`: barra relativa à maior linha.
   * `pct`: barra cheia = 100% ("barra cheia = 100%", §12.3).
   */
  modo: 'quantidade' | 'pct';
  selecionado?: number | null;
  /** Com ela, cada coluna vira um botão (`aria-pressed`); sem ela, só desenho. */
  onSelecionar?: (semestre: number) => void;
  /** Altura da área das barras, em px (padrão 140). */
  altura?: number;
}

const TEXTO_MARCA = 'text-[color:var(--gp-brand-strong)] dark:text-[color:var(--gp-brand-on-dark)]';

/**
 * Barras por semestre (P8): uma coluna por linha recebida, mesmo com valor zero. O semestre
 * selecionado fica realçado (fundo de seleção) e os demais clareiam.
 */
export function BarrasPorSemestre({ rotulo, linhas, modo, selecionado = null, onSelecionar, altura = 140 }: BarrasPorSemestreProps) {
  const maximo = modo === 'pct' ? 100 : linhas.reduce((m, l) => Math.max(m, l.valor ?? 0), 0);
  const haSelecao = selecionado !== null && selecionado !== undefined;

  return (
    <FiguraGrafico
      rotulo={rotulo}
    >
      <div className="overflow-x-auto">
        <div className="flex items-end gap-1" style={{ minWidth: linhas.length * 32 }}>
          {linhas.map((l) => {
            const ativo = haSelecao && selecionado === l.semestre;
            const conteudo = (
              <>
                <span
                  className={`tabular-nums ${ativo ? TEXTO_MARCA : ''}`}
                  style={{
                    fontSize: 'var(--gp-font-size-micro)',
                    fontWeight: 'var(--gp-font-weight-medio)',
                    color: ativo ? undefined : 'var(--gp-text-1)',
                    lineHeight: '14px',
                  }}
                >
                  {l.texto}
                </span>
                <span className="flex w-full items-end justify-center" style={{ height: altura }}>
                  <span
                    data-testid="barra-semestre"
                    style={{
                      display: 'block',
                      width: '70%',
                      maxWidth: 32,
                      height: alturaDaBarra(l.valor ?? 0, maximo, altura),
                      background: haSelecao && !ativo ? COR_BARRA_CLARA : 'var(--gp-brand)',
                      borderRadius: 'var(--gp-radius-sm) var(--gp-radius-sm) 0 0',
                    }}
                  />
                </span>
                <span
                  className={ativo ? TEXTO_MARCA : ''}
                  style={{
                    marginTop: 4,
                    fontSize: 'var(--gp-font-size-label)',
                    fontWeight: 'var(--gp-font-weight-medio)',
                    color: ativo ? undefined : 'var(--gp-text-2)',
                  }}
                >
                  {l.semestre}º
                </span>
              </>
            );
            const estilo: React.CSSProperties = {
              padding: '4px 2px',
              borderRadius: 'var(--gp-radius-sm)',
              background: ativo ? 'var(--gp-brand-surface)' : 'transparent',
              border: `1px solid ${ativo ? 'var(--gp-brand-border)' : 'transparent'}`,
            };
            const classe = 'flex min-w-0 flex-1 flex-col items-center';

            return onSelecionar ? (
              <button
                key={l.semestre}
                type="button"
                aria-pressed={ativo}
                aria-label={`${l.semestre}º semestre: ${l.valor === null ? TRACO : l.texto}`}
                onClick={() => onSelecionar(l.semestre)}
                className={classe}
                style={estilo}
              >
                {conteudo}
              </button>
            ) : (
              <div key={l.semestre} className={classe} style={estilo}>
                {conteudo}
              </div>
            );
          })}
        </div>
      </div>
    </FiguraGrafico>
  );
}
