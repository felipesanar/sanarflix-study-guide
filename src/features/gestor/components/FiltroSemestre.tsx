import * as React from 'react';
import { useRef } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { FiltroSemestre as ValorSemestre } from '@/features/gestor/api/types';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';

type IdOpcao = '6ano' | 'geral' | 'por-semestre';

export const OPCOES_SEMESTRE: { id: IdOpcao; rotulo: string }[] = [
  { id: '6ano', rotulo: '6º ano (Padrão)' },
  { id: 'geral', rotulo: 'Geral' },
  { id: 'por-semestre', rotulo: 'Por semestre' },
];

export const SEMESTRES_NUMERICOS: ValorSemestre[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
];

/** Semestre numérico assumido ao entrar em "Por semestre". */
const PRIMEIRO_NUMERICO: ValorSemestre = '1';

const ehNumerico = (valor: ValorSemestre): boolean =>
  valor !== '6ano' && valor !== 'geral';

const indiceDe = (valor: ValorSemestre): number =>
  valor === '6ano' ? 0 : valor === 'geral' ? 1 : 2;

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

  const indiceAtivo = indiceDe(semestre);
  const mostrarDropdown = indiceAtivo === 2;

  const selecionar = (indice: number) => {
    if (disabled) return;
    if (indice === 0) setSemestre('6ano');
    else if (indice === 1) setSemestre('geral');
    else setSemestre(ehNumerico(semestre) ? semestre : PRIMEIRO_NUMERICO);
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
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Recorte de semestre"
        className={cn(
          'relative flex w-fit items-center rounded-lg bg-muted p-1',
          disabled && 'opacity-50',
        )}
      >
        <span
          aria-hidden="true"
          data-testid="filtro-semestre-indicador"
          className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-md bg-background shadow-sm transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${indiceAtivo * 100}%)` }}
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
                'relative z-10 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:cursor-not-allowed',
                ativo
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      {mostrarDropdown && (
        <Select
          value={semestre}
          disabled={disabled}
          onValueChange={(valor) => setSemestre(valor as ValorSemestre)}
        >
          <SelectTrigger aria-label="Semestre específico" className="h-8 w-[7.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEMESTRES_NUMERICOS.map((numero) => (
              <SelectItem key={numero} value={numero}>
                {`${numero}º`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};
