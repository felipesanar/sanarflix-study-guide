import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  const itemSize = 32;
  const gap = 6;
  const rows = Math.min(10, Math.max(1, totalQuestoes));
  const columns = Math.ceil(totalQuestoes / rows);
  const widthFactor = 1.2;
  const sidebarWidth = Math.max(256, Math.ceil(columns * (itemSize + gap) * widthFactor)) + 32; // + padding
  return (
    <div
      className="border-l bg-muted/20 p-4 flex flex-col gap-4"
      style={{ width: sidebarWidth }}
    >
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

      <div className="flex-1">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${columns}, ${itemSize}px)`,
          }}
        >
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
                  'w-8 h-8 rounded-md font-medium text-xs transition-all focus:outline-none focus:ring-2 focus:ring-primary',
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
      </div>
    </div>
  );
};
