import { Button } from '@/components/ui/button';
import { Trash2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AlternativaProvaProps {
  letra: 'A' | 'B' | 'C' | 'D';
  texto: string;
  selecionada: boolean;
  eliminada: boolean;
  onSelecionar: () => void;
  onEliminar: () => void;
}

export const AlternativaProva = ({
  letra,
  texto,
  selecionada,
  eliminada,
  onSelecionar,
  onEliminar
}: AlternativaProvaProps) => {
  return (
    <button
      className={cn(
        'group relative p-4 border-2 rounded-xl transition-all duration-200 focus:outline-none w-full text-left',
        selecionada && 'border-green-500 bg-green-500/10 shadow-md',
        !selecionada && !eliminada && 'border-border hover:border-primary/50 hover:bg-muted/30',
        eliminada && 'opacity-40 bg-muted/20 cursor-not-allowed'
      )}
      onClick={() => {
        if (eliminada) {
          onEliminar();
        }
        onSelecionar();
      }}
      aria-pressed={selecionada}
      type="button"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors',
            selecionada ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
          )}
        >
          {letra}
        </div>
        
        <p className={cn(
          'flex-1 text-sm leading-relaxed',
          eliminada && 'line-through'
        )}>
          {texto}
        </p>

        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity',
            eliminada ? 'opacity-100 text-red-500' : ''
          )}
          onClick={(e) => {
            e.stopPropagation();
            onEliminar();
          }}
          aria-label={eliminada ? 'Restaurar alternativa' : 'Eliminar alternativa'}
        >
          {eliminada ? <Undo2 className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </button>
  );
};
