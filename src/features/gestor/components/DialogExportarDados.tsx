import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/features/gestor/components/Icon';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { useToast } from '@/hooks/use-toast';
import {
  useAlunosExportacao,
  useCronograma,
  useDetalhamento,
  useGestorContexto,
  useQuestoes,
  useVisaoGeral,
} from '@/features/gestor/api/queries';
import { SeletorSimulados, motivoIndisponivel } from '@/features/gestor/components/SeletorSimulados';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useTelemetriaGestor } from '@/features/gestor/lib/telemetria';
import {
  BLOCOS_EXPORT,
  BLOCOS_PADRAO,
  blocosDisponiveis,
  exportarRecorte,
  type BlocoExport,
  type FormatoExport,
} from '@/features/gestor/lib/exportarRecorte';
import type { FiltroSemestre } from '@/features/gestor/api/types';

/** Mesma nomenclatura do `FiltroSemestre` da tela — o arquivo não pode chamar o recorte de outro nome. */
export function rotuloRecorteSemestre(semestre: FiltroSemestre): string {
  if (semestre === '6ano') return '6º ano';
  if (semestre === 'geral') return 'Geral (todos os semestres)';
  return `${semestre}º período`;
}

const FORMATOS: { id: FormatoExport; titulo: string; descricao: string }[] = [
  { id: 'pdf', titulo: 'PDF', descricao: 'Pronto para ler e circular na coordenação.' },
  { id: 'xlsx', titulo: 'Planilha (XLSX)', descricao: 'Uma aba por bloco, para continuar a análise.' },
];

export interface DialogExportarDadosProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  iesId: string;
}

/**
 * "Exportar dados" — terceira opção do Início. O gestor escolhe QUAIS blocos
 * quer levar e em qual formato; o arquivo é montado no cliente a partir dos
 * MESMOS dados das telas (nenhuma consulta nova de escopo diferente, nenhum
 * dado que o papel já não pudesse ver).
 *
 * A lista nominal de alunos é opcional, sai desmarcada e leva aviso de LGPD
 * dentro do arquivo (handoff §7.7). Blocos que dependem de simulado escolhido
 * ficam desabilitados enquanto não houver simulado no recorte.
 */
export function DialogExportarDados({ aberto, onAbertoChange, iesId }: DialogExportarDadosProps) {
  const { toast } = useToast();
  const { semestre, simulados } = useFiltrosGestor();
  const { data: contexto } = useGestorContexto();
  const { exportSolicitado } = useTelemetriaGestor();
  const [gerando, setGerando] = React.useState<FormatoExport | null>(null);
  const [selecionados, setSelecionados] = React.useState<Set<BlocoExport>>(
    () => new Set(BLOCOS_PADRAO),
  );

  /**
   * Escolha de simulados LOCAL do arquivo: o gestor precisa poder liberar os
   * blocos por simulado aqui dentro, sem voltar para a tela só para mexer no
   * filtro. Parte do recorte da URL a cada abertura e não escreve na URL —
   * exportar não muda o que as outras telas estão mostrando.
   */
  const [simuladosArquivo, setSimuladosArquivo] = React.useState<string[]>(simulados);
  React.useEffect(() => {
    if (aberto) setSimuladosArquivo(simulados);
    // Só reagir à abertura: mexer no seletor não pode ser sobrescrito pela URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const cronograma = useCronograma(aberto ? iesId : null);
  const itensCronograma = React.useMemo(() => cronograma.data ?? [], [cronograma.data]);

  /** Um id que ficou indisponível no cronograma não pode contar como recorte válido. */
  const simuladosValidos = React.useMemo(() => {
    if (itensCronograma.length === 0) return simuladosArquivo;
    return simuladosArquivo.filter((id) =>
      itensCronograma.some((item) => item.id === id && motivoIndisponivel(item) === null),
    );
  }, [itensCronograma, simuladosArquivo]);

  const disponiveis = React.useMemo(
    () => blocosDisponiveis(simuladosValidos.length),
    [simuladosValidos.length],
  );
  const filtros = React.useMemo(
    () => ({ iesId: aberto ? iesId : null, semestre, simulados: simuladosValidos }),
    [aberto, iesId, semestre, simuladosValidos],
  );


  const {
    data: visaoGeral,
    meta,
    isLoading,
    isError,
    refetch,
  } = useVisaoGeral(filtros);

  const querDetalhamento =
    aberto && (selecionados.has('metricasSimulados') || selecionados.has('acertoSemestre'));
  const detalhamentoQuery = useDetalhamento(
    filtros,
    querDetalhamento,
  );
  const { data: detalhamento, isLoading: carregandoDetalhamento } = detalhamentoQuery;

  const querQuestoes = aberto && selecionados.has('questoes') && disponiveis.has('questoes');
  const questoesQuery = useQuestoes(
    { ...filtros, iesId: querQuestoes ? filtros.iesId : null },
    { page: 1, pageSize: 300 },
  );
  const { data: questoes, isLoading: carregandoQuestoes } = questoesQuery;

  const querAlunos = aberto && selecionados.has('alunos');
  const alunosQuery = useAlunosExportacao(filtros, querAlunos);
  const { data: alunos, isLoading: carregandoAlunos } = alunosQuery;

  const carregandoExtras =
    (querDetalhamento && carregandoDetalhamento) ||
    (querQuestoes && carregandoQuestoes) ||
    (querAlunos && carregandoAlunos);
  const erroExtras =
    (querDetalhamento && detalhamentoQuery.isError) ||
    (querQuestoes && questoesQuery.isError) ||
    (querAlunos && alunosQuery.isError);

  const iesNome =
    contexto?.iesDisponiveis.find((ies) => ies.id === iesId)?.nome ?? contexto?.iesAtual.nome ?? '';
  const semestreRotulo = rotuloRecorteSemestre(semestre);
  const simuladosRotulos = React.useMemo(
    () =>
      (visaoGeral?.evolucao ?? [])
        .filter((ponto) => simuladosValidos.includes(ponto.simuladoId))
        .map((ponto) => ponto.nome),
    [visaoGeral, simuladosValidos],
  );


  const alternar = (id: BlocoExport) => {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  };

  const escolhidos = BLOCOS_EXPORT.filter((b) => disponiveis.has(b.id) && selecionados.has(b.id));
  const prontoParaGerar = escolhidos.length > 0 && !carregandoExtras && !erroExtras;

  const gerar = async (formato: FormatoExport) => {
    if (!visaoGeral || !prontoParaGerar) return;
    setGerando(formato);
    try {
      const arquivo = exportarRecorte(
        formato,
        {
          iesNome,
          semestreRotulo,
          simuladosRotulos,
          visaoGeral,
          detalhamento,
          questoes: questoes?.data,
          alunos: alunos?.data,
          meta,
        },
        escolhidos.map((b) => b.id),
      );
      exportSolicitado('visao_geral');
      toast({ description: `Arquivo gerado: ${arquivo}` });
      onAbertoChange(false);
    } catch {
      toast({
        variant: 'destructive',
        description: 'Não foi possível gerar o arquivo agora. Tente novamente.',
      });
    } finally {
      setGerando(null);
    }
  };

  return (
    <Sheet open={aberto} onOpenChange={onAbertoChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[620px]"
        data-testid="dialog-exportar-dados"
      >
        <SheetHeader className="border-b border-border bg-card px-5 pb-5 pt-6 text-left sm:px-7">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Icon name="download" variant="filled" size={18} />
          </div>
          <SheetTitle className="font-sans" style={{ fontSize: 21, fontWeight: 700 }}>Montar relatório</SheetTitle>
          <SheetDescription>
            {iesNome ? `${iesNome} · ` : ''}{semestreRotulo}. Selecione o recorte, confira o conteúdo e baixe.
          </SheetDescription>
        </SheetHeader>

        {isError ? (
          <div className="px-6 pb-6">
            <EstadoErro
              titulo="Não foi possível carregar os dados do recorte."
              descricao="Sem eles o arquivo sairia incompleto."
              onRetry={refetch}
            />
          </div>
        ) : isLoading || !visaoGeral ? (
          <div className="px-6 pb-6">
            <GestorSkeleton altura={280} rotulo="Carregando dados do recorte" />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-6 bg-muted/30 px-5 py-6 sm:px-7">
              <section aria-labelledby="etapa-simulados" className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--gp-info)] text-xs font-bold text-primary-foreground">1</span>
                  <div><h3 id="etapa-simulados" className="text-sm font-bold text-foreground">Escolha os simulados</h3><p className="mt-0.5 text-xs text-muted-foreground">Essa seleção afeta somente o arquivo.</p></div>
                </div>
              {cronograma.isLoading ? (
                <GestorSkeleton altura={92} rotulo="Carregando simulados" />
              ) : itensCronograma.length === 0 ? (
                <p
                  className="p-3.5"
                  style={{
                    fontSize: 12.5,
                    lineHeight: '18px',
                    borderRadius: 'var(--gp-radius-md)',
                    background: 'var(--gp-surface-3)',
                    color: 'var(--gp-text-3)',
                  }}
                >
                  Esta instituição ainda não tem simulados disponíveis. Os blocos por simulado ficam
                  indisponíveis.
                </p>
              ) : (
                <SeletorSimulados
                  inline
                  opcional
                  itens={itensCronograma}
                  selecionados={simuladosValidos}
                  onChange={setSimuladosArquivo}
                />

              )}
              </section>

              <section aria-labelledby="etapa-conteudo" className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--gp-info)] text-xs font-bold text-primary-foreground">2</span>
                  <div><h3 id="etapa-conteudo" className="text-sm font-bold text-foreground">Defina o conteúdo</h3><p className="mt-0.5 text-xs text-muted-foreground">Marque apenas as análises necessárias.</p></div>
                </div>
              <div className="flex flex-col gap-2">
                {BLOCOS_EXPORT.map((bloco) => {
                  const habilitado = disponiveis.has(bloco.id);
                  const marcado = habilitado && selecionados.has(bloco.id);
                  const motivo = bloco.exigeSimuladoUnico
                    ? 'Escolha um único simulado acima para incluir.'
                    : 'Escolha ao menos um simulado acima para incluir.';

                  return (
                    <label
                      key={bloco.id}
                      data-testid={`bloco-${bloco.id}`}
                      className={`flex items-start gap-3 rounded-md border p-3.5 transition-colors ${
                        marcado ? 'border-[color:var(--gp-info)] bg-[color:var(--gp-info-surface)]' : 'border-border bg-background'
                      } ${habilitado ? 'cursor-pointer hover:border-[color:var(--gp-info)]' : 'cursor-not-allowed opacity-55'
                      }`}
                    >
                      <Checkbox
                        checked={marcado}
                        disabled={!habilitado || gerando !== null}
                        onCheckedChange={() => alternar(bloco.id)}
                        className="mt-0.5 h-5 w-5 border-[color:var(--gp-text-2)] data-[state=checked]:border-[color:var(--gp-info)] data-[state=checked]:bg-[color:var(--gp-info)]"
                        aria-label={bloco.titulo}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className="flex items-center gap-2"
                          style={{ fontSize: 14, fontWeight: 600, color: 'var(--gp-text-1)' }}
                        >
                          {bloco.titulo}
                          {bloco.nominal && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 'var(--gp-radius-pill)',
                                background: 'var(--gp-brand-surface)',
                                color: 'var(--gp-brand-strong)',
                              }}
                            >
                              DADO PESSOAL
                            </span>
                          )}
                        </span>
                        <span
                          className="mt-0.5 block"
                          style={{ fontSize: 12.5, lineHeight: '18px', color: 'var(--gp-text-3)' }}
                        >
                          {habilitado ? bloco.descricao : motivo}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>

              {selecionados.has('alunos') && disponiveis.has('alunos') && (
                <div className="mt-3 flex gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-foreground">
                  <Icon name="info" size={16} className="mt-0.5 shrink-0 text-primary" />
                  <span><strong>Dado pessoal.</strong> O arquivo terá nomes de alunos. Compartilhe apenas com finalidade pedagógica.</span>
                </div>
              )}
              </section>

              <section aria-labelledby="etapa-formato" className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--gp-info)] text-xs font-bold text-primary-foreground">3</span>
                  <div><h3 id="etapa-formato" className="text-sm font-bold text-foreground">Confira e baixe</h3><p className="mt-0.5 text-xs text-muted-foreground">O arquivo só é liberado quando todos os dados estiverem completos.</p></div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-xs sm:grid-cols-3">
                  <div><span className="block text-muted-foreground">Blocos</span><strong>{escolhidos.length}</strong></div>
                  <div><span className="block text-muted-foreground">Simulados</span><strong>{simuladosValidos.length || 'Recorte geral'}</strong></div>
                  <div className="col-span-2 sm:col-span-1"><span className="block text-muted-foreground">Alunos</span><strong>{querAlunos ? (carregandoAlunos ? 'Carregando…' : alunos?.total ?? 'Indisponível') : 'Não incluídos'}</strong></div>
                </div>

                {erroExtras && (
                  <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    Não foi possível carregar todo o conteúdo selecionado. Tente novamente antes de gerar o arquivo.
                    <Button variant="outline" size="sm" className="mt-2 h-8" onClick={() => { detalhamentoQuery.refetch(); questoesQuery.refetch(); alunosQuery.refetch(); }}>Tentar novamente</Button>
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                {FORMATOS.map((formato) => (
                  <Button
                    key={formato.id}
                    type="button"
                    data-testid={`exportar-${formato.id}`}
                    disabled={gerando !== null || !prontoParaGerar}
                    onClick={() => void gerar(formato.id)}
                    variant={formato.id === 'pdf' ? 'default' : 'outline'}
                    className="h-11 justify-start gap-2 px-3"
                  >
                    <Icon name={formato.id === 'pdf' ? 'documents' : 'download'} variant="filled" size={16} />
                    {gerando === formato.id ? 'Gerando…' : `Baixar ${formato.titulo}`}
                  </Button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{carregandoExtras ? 'Conferindo dados selecionados…' : prontoParaGerar ? 'Arquivo pronto para gerar.' : 'Selecione ao menos um bloco.'}</p>
                <Button variant="ghost" size="sm" onClick={() => onAbertoChange(false)}>
                  Cancelar
                </Button>
              </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
