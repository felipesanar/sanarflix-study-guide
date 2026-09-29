import { useState } from 'react';
import { ChevronDown, Ban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ImageLightbox } from '@/components/simulados/ImageLightbox';
import { cn } from '@/lib/utils';
import type { QuestaoProvaOficial } from '../types';

const LETRAS = ['A', 'B', 'C', 'D'] as const;

interface QuestaoRevisaoProps {
  questao: QuestaoProvaOficial;
  /** Caderno EFETIVO do aluno (fallback 1) — nunca o caderno 1 fixo. */
  caderno: number;
}

/**
 * Revisão de uma questão da prova oficial no caderno do PRÓPRIO aluno
 * (spec D4). Nunca exibe TRI/proficiência — só o gabarito preliminar do
 * INEP, a resposta do aluno e o comentário do professor.
 */
export const QuestaoRevisao = ({ questao, caderno }: QuestaoRevisaoProps) => {
  const [comentarioAberto, setComentarioAberto] = useState(false);
  const temComentario = !!(questao.comentario || questao.imagemComentario);

  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-border/40 bg-muted/[0.03] flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold tracking-tight">
            Caderno {caderno} · Questão {questao.posicao}
          </span>
          {questao.grandeArea && (
            <Badge variant="outline" className="text-[11px] font-medium">
              {questao.grandeArea}
            </Badge>
          )}
          {questao.anulada && (
            <Badge
              variant="outline"
              className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25 gap-1"
            >
              <Ban className="h-3 w-3" /> Questão anulada
            </Badge>
          )}
        </div>
        {caderno !== 1 && (
          <p className="text-xs text-muted-foreground">
            no Caderno 1 era a questão {questao.numeroCaderno1}
          </p>
        )}
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-4">
        <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-line text-foreground/90">
          {questao.enunciado}
        </p>

        {questao.imagem && (
          <div className="flex justify-center">
            <ImageLightbox
              src={questao.imagem}
              alt={`Imagem da questão ${questao.posicao}`}
              className="max-w-full max-h-72 rounded-xl object-contain"
            />
          </div>
        )}
        {questao.imagem2 && (
          <div className="flex justify-center">
            <ImageLightbox
              src={questao.imagem2}
              alt={`Imagem 2 da questão ${questao.posicao}`}
              className="max-w-full max-h-72 rounded-xl object-contain"
            />
          </div>
        )}

        <div className="space-y-2">
          {LETRAS.map((letra) => {
            const texto = questao.alternativas[letra];
            if (!texto) return null;
            const isCorreta = questao.correta === letra;
            const isResposta = questao.resposta === letra;
            const isErrada = isResposta && !questao.acertou;

            return (
              <div
                key={letra}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm',
                  isCorreta && 'border-green-500/30 bg-green-500/[0.06]',
                  isErrada && 'border-red-500/30 bg-red-500/[0.06]',
                  !isCorreta && !isErrada && 'border-border/50',
                )}
              >
                <span className="font-bold shrink-0">{letra}</span>
                <span className="flex-1">{texto}</span>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isCorreta && (
                    <Badge
                      variant="outline"
                      className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 whitespace-nowrap"
                    >
                      Gabarito preliminar do INEP
                    </Badge>
                  )}
                  {isResposta && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'whitespace-nowrap',
                        isErrada
                          ? 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30'
                          : 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
                      )}
                    >
                      Sua resposta
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {questao.resposta === null && (
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Em branco</p>
        )}

        {temComentario && (
          <Collapsible open={comentarioAberto} onOpenChange={setComentarioAberto}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl',
                  'text-sm font-semibold transition-colors',
                  'bg-primary/[0.04] hover:bg-primary/[0.07] text-primary',
                )}
              >
                <span>Comentário do professor</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', comentarioAberto && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-3">
              {questao.comentario && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {questao.comentario}
                </p>
              )}
              {questao.imagemComentario && (
                <div className="flex justify-center">
                  <ImageLightbox
                    src={questao.imagemComentario}
                    alt={`Imagem do comentário da questão ${questao.posicao}`}
                    className="max-w-full max-h-72 rounded-xl object-contain"
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
};
