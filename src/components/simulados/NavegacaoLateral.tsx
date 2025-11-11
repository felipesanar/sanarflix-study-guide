import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavegacaoLateralProps {
  totalQuestoes: number;
  questaoAtual: number;
  questoesRespondidas: Set<number>;
  questoesMarcadasRevisao: Set<number>;
  onIrParaQuestao: (index: number) => void;
}

export const NavegacaoLateral = ({
  totalQuestoes,
  questaoAtual,
  questoesRespondidas,
  questoesMarcadasRevisao,
  onIrParaQuestao
}: NavegacaoLateralProps) => {
  return (
    <div className="w-64 border-l bg-muted/20 p-4 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-sm mb-3">Navegação</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Respondida</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Marcada para revisão</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
            <span>Não respondida</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: totalQuestoes }, (_, i) => {
            const numero = i + 1;
            const respondida = questoesRespondidas.has(i);
            const marcadaRevisao = questoesMarcadasRevisao.has(i);
            const atual = i === questaoAtual;

            return (
              <button
                key={i}
                onClick={() => onIrParaQuestao(i)}
                className={cn(
                  'w-10 h-10 rounded-lg font-medium text-sm transition-all',
                  atual && 'ring-2 ring-primary ring-offset-2',
                  respondida && !marcadaRevisao && 'bg-green-500 text-white hover:bg-green-600',
                  marcadaRevisao && 'bg-blue-500 text-white hover:bg-blue-600',
                  !respondida && !marcadaRevisao && 'bg-muted hover:bg-muted/80 text-muted-foreground'
                )}
              >
                {numero}
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
