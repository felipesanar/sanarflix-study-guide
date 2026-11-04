import * as React from 'react';
import { mesCurto } from '@/features/gestor/lib/engajamento';
import { FiguraGrafico } from './FiguraGrafico';

/** Cor de barra de mês parcial / de série secundária (§13: tom intermediário da marca). */
export const COR_BARRA_CLARA = 'color-mix(in srgb, var(--gp-brand) 45%, var(--gp-surface-1))';

export interface PontoBarraMensal {
  /** 'AAAA-MM'. */
  mes: string;
  parcial: boolean;
  valor: number;
  /** Texto escrito acima da barra (já formatado: "63%", "145.873"). */
  texto: string;
  /** Linha extra abaixo do rótulo do mês ("180 alunos"). */
  sub?: string;
}

export interface BarrasMensaisProps {
  /** Nome acessível da figura. */
  rotulo: string;
  pontos: PontoBarraMensal[];
  /** Altura da área das barras, em px (padrão 160). */
  altura?: number;
  /** Cor das barras de mês fechado (padrão: marca). */
  corFechada?: string;
  /** Cor das barras de mês parcial (padrão: tom claro da marca). */
  corParcial?: string;
  /** 'AAAA-MM' do mês a pôr em destaque (o mês atual); ganha `corDestaque` mesmo se parcial. */
  mesDestaque?: string;
  corDestaque?: string;
}

/** Linha do valor (16px) + respiro de 8px entre ele e o topo da barra. */
const RESPIRO_VALOR = 8;
const ALTURA_VALOR = 16 + RESPIRO_VALOR;

/** Altura, em px, de uma barra: proporcional ao maior valor; valor > 0 nunca some. */
export function alturaDaBarra(valor: number, maximo: number, altura: number): number {
  if (!(maximo > 0) || !(valor > 0)) return 0;
  return Math.max(2, Math.round((valor / maximo) * altura));
}

/**
 * Barras verticais mensais (spec §10.6): altura proporcional ao maior valor da
 * série (o máximo ocupa 100% da área útil), valor escrito acima, rótulo do mês
 * abaixo. Mês parcial: cor mais clara e `*` no rótulo.
 */
export function BarrasMensais({
  rotulo,
  pontos,
  altura = 160,
  corFechada = 'var(--gp-brand)',
  corParcial = COR_BARRA_CLARA,
  mesDestaque,
  corDestaque = 'var(--gp-brand)',
}: BarrasMensaisProps) {
  const maximo = pontos.reduce((m, p) => Math.max(m, p.valor), 0);

  return (
    <FiguraGrafico rotulo={rotulo}>
      <div className="overflow-x-auto">
        <div className="flex items-end gap-2" style={{ minWidth: pontos.length * 36 }}>
          {pontos.map((p) => (
            <div key={p.mes} className="flex min-w-0 flex-1 flex-col items-center">
              {/* Valor e barra juntos, colados no fundo: o valor sobe com a barra e fica
                  sempre a 8px do topo dela, inclusive na mais alta (altura + 24px de folga). */}
              <div className="flex w-full flex-col items-center justify-end" style={{ height: altura + ALTURA_VALOR }}>
                <span
                  className="tabular-nums"
                  style={{
                    fontSize: 'var(--gp-font-size-apoio)',
                    fontWeight: 'var(--gp-font-weight-medio)',
                    color: 'var(--gp-text-1)',
                    lineHeight: '16px',
                    marginBottom: RESPIRO_VALOR,
                  }}
                >
                  {p.texto}
                </span>
                <div
                  data-testid="barra-mensal"
                  data-parcial={p.parcial ? 'true' : 'false'}
                  style={{
                    width: '70%',
                    maxWidth: 48,
                    height: alturaDaBarra(p.valor, maximo, altura),
                    background: p.mes === mesDestaque ? corDestaque : p.parcial ? corParcial : corFechada,
                    borderRadius: 'var(--gp-radius-sm) var(--gp-radius-sm) 0 0',
                  }}
                />
              </div>
              <span
                style={{
                  marginTop: 4,
                  fontSize: 'var(--gp-font-size-label)',
                  fontWeight: 'var(--gp-font-weight-medio)',
                  color: 'var(--gp-text-2)',
                }}
              >
                {mesCurto(p.mes, p.parcial)}
              </span>
              {p.sub ? (
                <span style={{ fontSize: 'var(--gp-font-size-micro)', color: 'var(--gp-text-3)', textAlign: 'center' }}>{p.sub}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </FiguraGrafico>
  );
}
