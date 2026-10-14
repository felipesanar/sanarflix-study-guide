import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { SimuladoDisponivel } from './util';

interface Props {
  disponiveis: SimuladoDisponivel[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
}

const dataCurta = (iso: string): string => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[1]}` : '';
};

/**
 * "Simulados no recorte": chips removíveis + "Adicionar outro" + "Limpar seleção".
 * Versão enxuta do SeletorSimulados do Gestor (aquele depende de cronograma e
 * filtros globais do gestor). Não existe "todos": sempre se escolhe a dedo.
 */
export const SeletorSimuladosMentor: React.FC<Props> = ({ disponiveis, selecionados, onChange }) => {
  const [aberto, setAberto] = React.useState(false);
  const escolhidos = disponiveis.filter((s) => selecionados.includes(s.id));
  const restantes = disponiveis.filter((s) => !selecionados.includes(s.id));

  return (
    <section aria-label="Simulados no recorte" className="space-y-2">
      <p className="text-sm font-medium">Simulados no recorte</p>
      <div className="flex flex-wrap items-center gap-2">
        {escolhidos.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm"
          >
            {s.rotulo}
            <button
              type="button"
              aria-label={`Remover ${s.rotulo}`}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={() => onChange(selecionados.filter((id) => id !== s.id))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={restantes.length === 0}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Adicionar outro
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-60 space-y-1 p-2">
            {restantes.map((s) => (
              <button
                key={s.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange([...selecionados, s.id]);
                  setAberto(false);
                }}
              >
                <span>{s.rotulo}</span>
                <span className="text-xs text-muted-foreground">{dataCurta(s.ultima_finalizacao)}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {escolhidos.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Limpar seleção
          </Button>
        )}
      </div>
    </section>
  );
};
