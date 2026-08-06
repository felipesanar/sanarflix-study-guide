import * as React from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import type { FiltroSemestre as ValorSemestre } from '@/features/gestor/api/types';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

type IdOpcao = '6ano' | 'geral' | 'por-semestre';

export const OPCOES_SEMESTRE: { id: IdOpcao; rotulo: string }[] = [
  { id: '6ano', rotulo: '6º ano (Padrão)' },
  { id: 'geral', rotulo: 'Geral' },
  { id: 'por-semestre', rotulo: 'Por semestre' },
];

export const SEMESTRES_NUMERICOS: ValorSemestre[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

/** Padding do trilho, em px (referência: `padding:3px`). O realce vive dentro dele. */
const PADDING_TRILHO = 3;

/**
 * Raio do segmento, em px. Fora da escala geral do portal {8-9, 12, 16, 10em}
 * de propósito: a referência crava `border-radius:6px` no `.sem-lb`, e um raio
 * de 8px numa pastilha de 28px de altura já lê como pílula.
 */
const RAIO_SEGMENTO = 6;

const ehNumerico = (valor: ValorSemestre): boolean =>
  valor !== '6ano' && valor !== 'geral';

/** "11º período" — o rótulo que a referência usa no gatilho e nas opções. */
const rotuloPeriodo = (numero: ValorSemestre): string => `${numero}º período`;

/**
 * Filtro global de semestre (spec §4.5) — idêntico na Visão Geral e no
 * Detalhamento, persistido na URL, seleção ÚNICA em toda a página.
 *
 * Controle segmentado com indicador que DESLIZA por `transform` (não pisca);
 * o 3º segmento revela o dropdown 1º…12º. Semântica de `radiogroup` com
 * roving tabIndex: setas movem seleção e foco juntos.
 */
export const FiltroSemestre: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const { semestre, setSemestre } = useFiltrosGestor();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const trilhoRef = useRef<HTMLDivElement | null>(null);
  const container = useGestorPortalContainer();

  /**
   * MODO ≠ VALOR. Na referência, marcar o 3º segmento só faz o dropdown
   * aparecer (`#semPor:checked ~ .sem-dd{ display:inline-flex; }`) — o recorte
   * segue o anterior até alguém escolher um número. Antes daqui o clique
   * gravava `?semestre=1` na hora e a tela inteira recalculava para o 1º
   * semestre, uma população que ninguém pediu, só para depois a pessoa
   * escolher o semestre que queria. Por isso "por semestre" é estado de UI
   * local e não passa pela URL.
   */
  const [modoPorSemestre, setModoPorSemestre] = useState(false);

  const emPorSemestre = ehNumerico(semestre) || modoPorSemestre;
  const indiceAtivo = emPorSemestre ? 2 : semestre === 'geral' ? 1 : 0;

  /**
   * Geometria do rótulo ativo. A referência não tem faixa deslizante: o realce
   * é o fundo do próprio `<label>`, logo tem sempre a largura dele — e os três
   * rótulos têm larguras BEM diferentes ("6º ano (Padrão)" × "Geral"). Medir é
   * o que mantém o realce coincidindo com o rótulo; a alternativa (`flex-1`
   * nos três) igualaria os segmentos e inflaria o controle em ~30%.
   * `null` = ainda não medido (ou ambiente sem layout, como o jsdom dos
   * testes): cai no modelo de terços, que é o comportamento antigo.
   */
  const [realce, setRealce] = useState<{ esquerda: number; largura: number } | null>(null);

  useLayoutEffect(() => {
    const alvo = refs.current[indiceAtivo];
    const trilho = trilhoRef.current;
    if (!alvo || !trilho) return;

    const medir = () => {
      const largura = alvo.offsetWidth;
      setRealce(largura > 0 ? { esquerda: alvo.offsetLeft, largura } : null);
    };
    medir();

    // Re-medir em resize/webfont: o peso do rótulo ativo muda de 500 para 600
    // e as larguras mudam junto. jsdom não tem ResizeObserver — sem o guarda,
    // o efeito quebraria o render inteiro nos testes.
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(medir);
    observador.observe(trilho);
    return () => observador.disconnect();
  }, [indiceAtivo]);

  const selecionar = (indice: number) => {
    if (disabled) return;
    if (indice === 2) {
      setModoPorSemestre(true);
      return; // só REVELA o dropdown — ver comentário de `modoPorSemestre`
    }
    setModoPorSemestre(false);
    setSemestre(indice === 0 ? '6ano' : 'geral');
  };

  const aoTeclar = (evento: React.KeyboardEvent<HTMLButtonElement>) => {
    const total = OPCOES_SEMESTRE.length;
    let proximo: number | null = null;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      proximo = (indiceAtivo + 1) % total;
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      proximo = (indiceAtivo - 1 + total) % total;
    } else if (evento.key === 'Home') {
      proximo = 0;
    } else if (evento.key === 'End') {
      proximo = total - 1;
    }
    if (proximo === null) return;
    evento.preventDefault();
    selecionar(proximo);
    refs.current[proximo]?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        ref={trilhoRef}
        role="radiogroup"
        aria-label="Recorte de semestre"
        className={cn('relative flex w-fit items-center', disabled && 'opacity-50')}
        style={{
          background: 'var(--gp-surface-3)',
          border: '1px solid var(--gp-border-strong)',
          borderRadius: 'var(--gp-radius-sm)',
          padding: PADDING_TRILHO,
          whiteSpace: 'nowrap',
        }}
      >
        {/* Pastilha PREENCHIDA de alto contraste: quase-preto no claro, marca no
            escuro (onde --gp-text-1 é claro e inverteria a figura de novo). */}
        <span
          aria-hidden="true"
          data-testid="filtro-semestre-indicador"
          className="pointer-events-none absolute z-0 bg-[var(--gp-text-1)] dark:bg-[var(--gp-brand)]"
          style={{
            top: PADDING_TRILHO,
            bottom: PADDING_TRILHO,
            left: PADDING_TRILHO,
            borderRadius: RAIO_SEGMENTO,
            width: realce
              ? realce.largura
              : `calc((100% - ${PADDING_TRILHO * 2}px) / ${OPCOES_SEMESTRE.length})`,
            transform: realce
              ? `translateX(${realce.esquerda - PADDING_TRILHO}px)`
              : `translateX(${indiceAtivo * 100}%)`,
            transitionProperty: 'transform, width',
            transitionDuration: 'var(--gp-motion-3)',
            transitionTimingFunction: 'var(--gp-ease)',
          }}
        />
        {OPCOES_SEMESTRE.map((opcao, indice) => {
          const ativo = indice === indiceAtivo;
          return (
            <button
              key={opcao.id}
              ref={(elemento) => { refs.current[indice] = elemento; }}
              type="button"
              role="radio"
              aria-checked={ativo}
              tabIndex={ativo ? 0 : -1}
              disabled={disabled}
              onClick={() => selecionar(indice)}
              onKeyDown={aoTeclar}
              className={cn(
                'relative z-10 whitespace-nowrap',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed',
                ativo
                  ? 'text-[color:var(--gp-text-inverse)]'
                  : 'text-[color:var(--gp-text-3)] hover:text-[color:var(--gp-text-2)]',
              )}
              style={{
                padding: '7px 13px',
                borderRadius: RAIO_SEGMENTO,
                fontSize: 12,
                fontWeight: ativo ? 600 : 500,
                // Cross-fade do rótulo na mesma janela do deslizamento (motion-3).
                transitionProperty: 'color',
                transitionDuration: 'var(--gp-motion-3)',
                transitionTimingFunction: 'var(--gp-ease)',
              }}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {emPorSemestre && (
        <Select
          // `''` (e não `undefined`) enquanto ninguém escolheu: mantém o Select
          // controlado desde o primeiro render e deixa o gatilho no placeholder.
          value={ehNumerico(semestre) ? semestre : ''}
          disabled={disabled}
          onValueChange={(valor) => setSemestre(valor as ValorSemestre)}
        >
          <SelectTrigger
            aria-label="Semestre específico"
            className="h-auto w-auto justify-start gap-2 focus:ring-0 focus:ring-offset-0"
            style={{
              background: 'var(--gp-surface-1)',
              border: '1px solid var(--gp-border-input)',
              borderRadius: 'var(--gp-radius-sm)',
              padding: '6px 11px',
              fontSize: 12.5,
              color: 'var(--gp-text-1)',
            }}
            icon={
              <Icon
                name="expand_more"
                size={15}
                className="text-[color:var(--gp-text-3)]"
              />
            }
          >
            {/* Filhos DIRETOS: a classe base do trigger tem `[&>span]:line-clamp-1`,
                que vira `display:-webkit-box` — um wrapper `inline-flex` aqui
                perderia o display para ela. */}
            <Icon
              name="calendar_month"
              variant="filled"
              size={15}
              className="text-[color:var(--gp-text-3)]"
            />
            {ehNumerico(semestre) ? (
              <span>
                Semestre: <b style={{ fontWeight: 600 }}>{rotuloPeriodo(semestre)}</b>
              </span>
            ) : (
              <span className="text-[color:var(--gp-text-3)]">Escolha o semestre</span>
            )}
          </SelectTrigger>
          <SelectContent
            container={container}
            scrollUpIcon={<Icon name="expand_less" size={14} />}
            scrollDownIcon={<Icon name="expand_more" size={14} />}
          >
            {SEMESTRES_NUMERICOS.map((numero) => (
              <SelectItem
                key={numero}
                value={numero}
                indicatorIcon={<Icon name="check" size={13} />}
              >
                {rotuloPeriodo(numero)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
