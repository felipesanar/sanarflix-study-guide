import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { QuestaoDetalhe } from '@/services/mentor/desempenho';
import {
  derivarDistribuicao,
  formatPct,
  formatRespostas,
  guardarDestinatariosMural,
  rotuloSimulado,
  urlIntervencao,
  urlMural,
} from './util';

interface Props {
  questao: QuestaoDetalhe | null;
  /** E-mail (minúsculo) → nome, vindo do desempenho da turma. */
  nomes: Record<string, string | null>;
  onFechar: () => void;
}

/**
 * Painel da questão: distribuição por alternativa (gabarito marcado, distrator
 * dominante sinalizado) e "Quem marcou X" para cada alternativa errada.
 * Versão enxuta da DistribuicaoAlternativas do Gestor (aquela depende de
 * filtros e queries do gestor). O backend pode omitir a lista de e-mails de
 * uma alternativa (ex.: a correta); nesse caso mostramos só a contagem.
 */
export const PainelQuestao: React.FC<Props> = ({ questao, nomes, onFechar }) => {
  const navigate = useNavigate();
  const dist = questao ? derivarDistribuicao(questao) : null;

  const mensagem = (emails: string[]) => {
    guardarDestinatariosMural(emails);
    navigate(urlMural(emails));
  };

  return (
    <Sheet open={!!questao} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {questao && dist && (
          <>
            <SheetHeader>
              <SheetTitle>
                Questão {questao.numero} · {rotuloSimulado(questao.sequence_number)}
              </SheetTitle>
              <SheetDescription>
                {questao.grande_area} · {questao.tema} · {formatPct(questao.acerto_pct)} de acerto ·{' '}
                {formatRespostas(questao.respostas)}
              </SheetDescription>
            </SheetHeader>

            <section aria-label="Distribuição por alternativa" className="mt-4 space-y-2">
              <h3 className="text-sm font-semibold">Distribuição por alternativa</h3>
              <ul className="space-y-2">
                {dist.alternativas.map((alt) => (
                  <li
                    key={alt.letra}
                    data-testid={`alternativa-${alt.letra}`}
                    className="space-y-1 rounded-lg border p-2"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">
                        {alt.letra}
                        {alt.correta && (
                          <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                            Gabarito
                          </span>
                        )}
                        {alt.dominante && (
                          <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">
                            Distrator dominante
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {alt.contagem} · {formatPct(alt.pct)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          alt.correta ? 'bg-emerald-500' : alt.dominante ? 'bg-red-500' : 'bg-slate-400',
                        )}
                        style={{ width: `${Math.min(100, alt.pct)}%` }}
                      />
                    </div>
                  </li>
                ))}
                {dist.branco > 0 && (
                  <li data-testid="alternativa-branco" className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span className="font-medium">Em branco</span>
                    <span className="text-muted-foreground">
                      {dist.branco} · {formatPct(dist.brancoPct)}
                    </span>
                  </li>
                )}
              </ul>
            </section>

            <section aria-label="Quem marcou" className="mt-6 space-y-4">
              {dist.alternativas
                .filter((alt) => !alt.correta && alt.contagem > 0)
                .map((alt) => {
                  const emails = questao.emails?.[alt.letra] ?? [];
                  return (
                    <div key={alt.letra} className="space-y-2">
                      <h3 className="text-sm font-semibold">
                        Quem marcou {alt.letra}{' '}
                        <span className="font-normal text-muted-foreground">({alt.contagem})</span>
                      </h3>
                      {emails.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Os alunos desta alternativa não estão disponíveis neste recorte.
                        </p>
                      ) : (
                        <>
                          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                            {emails.map((email) => {
                              const nome = nomes[email.toLowerCase()];
                              return (
                                <li key={email}>
                                  {nome ? (
                                    <>
                                      <span>{nome}</span>{' '}
                                      <span className="text-xs text-muted-foreground">{email}</span>
                                    </>
                                  ) : (
                                    <span>{email}</span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => mensagem(emails)}
                            >
                              Mensagem pra quem marcou {alt.letra}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label={`Criar intervenção — quem marcou ${alt.letra}`}
                              onClick={() => navigate(urlIntervencao(emails))}
                            >
                              Criar intervenção
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
