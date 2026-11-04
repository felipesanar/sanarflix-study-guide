import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ehLinkHttps } from '@/features/mentor/lib/linkSeguro';
import { semPrefixoAlternativa, textoSeguro } from '@/features/mentor/lib/textoSeguro';
import {
  chavesDesempenho,
  fetchQuestao,
  questaoNaoLiberada,
  type QuestaoCompleta,
  type QuestaoDetalhe,
} from '@/services/mentor/desempenho';
import {
  derivarDistribuicao,
  distribuicaoCompleta,
  formatPct,
  formatRespostas,
  rotuloSimulado,
  temaExibido,
  urlIntervencao,
  urlMural,
} from './util';

interface Props {
  questao: QuestaoDetalhe | null;
  /** Simulados do recorte atual (`p_simulados` da `mentor_questao`). */
  simulados: string[];
  /** E-mail (minúsculo) → nome, vindo do desempenho da turma. */
  nomes: Record<string, string | null>;
  onFechar: () => void;
}

/** Alternativa já normalizada: vem da `mentor_questao` (com texto) ou, enquanto ela carrega, do resumo do detalhamento. */
interface AlternativaView {
  letra: string;
  texto: string | null;
  contagem: number;
  pct: number;
  correta: boolean;
  dominante: boolean;
  emails: string[] | null;
}

function alternativasDoResumo(questao: QuestaoDetalhe): { alternativas: AlternativaView[]; branco: number; brancoPct: number } {
  const dist = derivarDistribuicao(questao);
  return {
    alternativas: dist.alternativas.map((a) => ({
      ...a,
      texto: null,
      emails: questao.emails?.[a.letra] ?? null,
    })),
    branco: dist.branco,
    brancoPct: dist.brancoPct,
  };
}

function alternativasDaQuestao(
  completa: QuestaoCompleta,
  resumo: QuestaoDetalhe,
): { alternativas: AlternativaView[]; branco: number; brancoPct: number } {
  const dist = distribuicaoCompleta(completa);
  return {
    alternativas: dist.alternativas.map((a) => ({
      ...a,
      // A RPC nova pode devolver `null` nos e-mails (ex.: gabarito): cai no que o detalhamento já trazia.
      emails: a.emails ?? resumo.emails?.[a.letra] ?? null,
    })),
    branco: dist.branco,
    brancoPct: dist.brancoPct,
  };
}

/** Só renderiza `<img>` para https com host; o resto some. Carrega sob demanda. */
const Imagem: React.FC<{ url: unknown; alt: string }> = ({ url, alt }) => {
  if (!ehLinkHttps(url)) return null;
  return (
    <img
      src={(url as string).trim()}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="max-h-80 w-auto max-w-full rounded-md border bg-white object-contain"
    />
  );
};

const Texto: React.FC<{ valor: string | null | undefined; className?: string; letra?: string }> = ({
  valor,
  className,
  letra,
}) => {
  const limpo = textoSeguro(valor);
  // O texto da alternativa já vem com o rótulo ("A) …") e o rótulo aparece como badge: tira a repetição.
  const t = letra ? semPrefixoAlternativa(limpo, letra) : limpo;
  if (!t) return null;
  // Texto puro (React escapa) com as quebras de linha preservadas.
  return <p className={cn('whitespace-pre-line break-words text-sm leading-relaxed', className)}>{t}</p>;
};

/**
 * Painel da questão (tela 04): enunciado, imagens e alternativas com texto vindos da `mentor_questao`
 * (buscada só quando o painel abre); distribuição (gabarito marcado, distrator dominante sinalizado),
 * "Quem marcou X" para cada alternativa errada e explicação recolhível. O resumo do `mentor_detalhamento`
 * aparece na hora, como placeholder, e continua valendo se a RPC nova faltar ou falhar.
 */
export const PainelQuestao: React.FC<Props> = ({ questao, simulados, nomes, onFechar }) => {
  const navigate = useNavigate();
  const [explicacaoAberta, setExplicacaoAberta] = React.useState(false);

  const id = questao?.questao_id ?? null;
  React.useEffect(() => setExplicacaoAberta(false), [id]);

  const completa = useQuery({
    queryKey: chavesDesempenho.questao(id ?? '', simulados),
    queryFn: () => fetchQuestao(id as string, simulados),
    enabled: !!id && simulados.length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const dados = completa.data ?? null;
  const dist = questao ? (dados ? alternativasDaQuestao(dados, questao) : alternativasDoResumo(questao)) : null;
  const naoLiberada = completa.isError && questaoNaoLiberada(completa.error);

  const mensagem = (emails: string[]) => navigate(urlMural(emails));

  const enunciado = textoSeguro(dados?.enunciado);
  const imagens = (dados?.imagens ?? []).filter(ehLinkHttps);
  const temImagemBloqueada = !!questao?.tem_imagem && !!dados && imagens.length === 0;
  const explicacao = textoSeguro(dados?.explicacao);
  const explicacaoImagem = dados?.explicacao_imagem_url;
  const temExplicacao = explicacao.length > 0 || ehLinkHttps(explicacaoImagem);

  return (
    <Sheet open={!!questao} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {questao && dist && (
          <>
            <SheetHeader>
              <SheetTitle>
                Questão {questao.numero} · {rotuloSimulado(questao.sequence_number)}
              </SheetTitle>
              <SheetDescription>
                {[
                  questao.grande_area,
                  dados?.especialidade ?? questao.especialidade,
                  temaExibido({ tema_curto: dados?.tema_curto ?? questao.tema_curto, tema: questao.tema }),
                  dados?.dificuldade ?? questao.dificuldade,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {' · '}
                {formatPct(questao.acerto_pct)} de acerto · {formatRespostas(questao.respostas)}
              </SheetDescription>
            </SheetHeader>

            <section aria-label="Enunciado" className="mt-4 space-y-3">
              {completa.isLoading && (
                <div className="space-y-2" aria-busy="true" data-testid="enunciado-carregando">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              )}
              {naoLiberada && (
                <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  O resultado deste simulado ainda não foi liberado aos alunos, por isso o enunciado e o gabarito
                  ficam ocultos por enquanto.
                </p>
              )}
              {completa.isError && !naoLiberada && (
                <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>Não foi possível carregar o enunciado.</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void completa.refetch()}>
                    Tentar de novo
                  </Button>
                </div>
              )}
              {dados && (
                <>
                  {enunciado ? (
                    <Texto valor={dados.enunciado} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Esta questão não tem enunciado cadastrado.</p>
                  )}
                  {imagens.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {imagens.map((url) => (
                        <Imagem key={url} url={url} alt={`Imagem da questão ${questao.numero}`} />
                      ))}
                    </div>
                  )}
                  {temImagemBloqueada && (
                    <p className="text-xs text-muted-foreground">
                      Esta questão tem imagem, mas o endereço dela não pôde ser exibido com segurança.
                    </p>
                  )}
                </>
              )}
            </section>

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
                      <span className="shrink-0 text-muted-foreground">
                        {alt.contagem} · {formatPct(alt.pct)}
                      </span>
                    </div>
                    {alt.texto && <Texto valor={alt.texto} letra={alt.letra} className="text-muted-foreground" />}
                    <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          alt.correta ? 'bg-emerald-500' : alt.dominante ? 'bg-red-500' : 'bg-slate-400',
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, alt.pct))}%` }}
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
                  const emails = alt.emails ?? [];
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
                            <Button type="button" size="sm" onClick={() => mensagem(emails)}>
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

            {temExplicacao && (
              <section aria-label="Explicação" className="mt-6 border-t pt-4">
                <button
                  type="button"
                  aria-expanded={explicacaoAberta}
                  aria-controls="explicacao-questao"
                  onClick={() => setExplicacaoAberta((v) => !v)}
                  className="flex w-full items-center gap-1 text-left text-sm font-semibold"
                >
                  {explicacaoAberta ? (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  )}
                  Explicação
                </button>
                {explicacaoAberta && (
                  <div id="explicacao-questao" className="mt-2 space-y-3">
                    <Texto valor={dados?.explicacao} />
                    <Imagem url={explicacaoImagem} alt={`Imagem da explicação da questão ${questao.numero}`} />
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
