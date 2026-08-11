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
  useAlunos,
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
  const { data: detalhamento, isLoading: carregandoDetalhamento } = useDetalhamento(
    filtros,
    querDetalhamento,
  );

  const querQuestoes = aberto && selecionados.has('questoes') && disponiveis.has('questoes');
  const { data: questoes, isLoading: carregandoQuestoes } = useQuestoes(
    { ...filtros, iesId: querQuestoes ? filtros.iesId : null },
    { page: 1, pageSize: 300 },
  );

  const querAlunos = aberto && selecionados.has('alunos');
  const { data: alunos, isLoading: carregandoAlunos } = useAlunos(
    { ...filtros, iesId: querAlunos ? filtros.iesId : null },
    { page: 1, pageSize: 500 },
  );

  const carregandoExtras =
    (querDetalhamento && carregandoDetalhamento) ||
    (querQuestoes && carregandoQuestoes) ||
    (querAlunos && carregandoAlunos);

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

  const gerar = async (formato: FormatoExport) => {
    if (!visaoGeral || escolhidos.length === 0) return;
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
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-[560px]"
        data-testid="dialog-exportar-dados"
      >
        <SheetHeader className="space-y-2 px-6 pb-5 pt-6 text-left">
          <SheetTitle style={{ fontSize: 19, fontWeight: 700 }}>Exportar dados</SheetTitle>
          <SheetDescription>
            {iesNome ? `${iesNome} · ` : ''}
            {semestreRotulo}. Escolha o que entra no arquivo e o formato. O relatório leva só o
            recorte que você está vendo agora.
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
            <div className="flex-1 px-6 pb-4">
              <p
                className="pb-3"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}
              >
                SIMULADOS DO ARQUIVO
              </p>
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
                  itens={itensCronograma}
                  selecionados={simuladosValidos}
                  onChange={setSimuladosArquivo}
                />
              )}
              <p className="mt-2" style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>
                Escolher aqui só muda este arquivo. O filtro das telas continua como está.
              </p>

              <p
                className="pb-3 pt-5"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}
              >
                O QUE ENTRA NO ARQUIVO
              </p>

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
                      className={`flex items-start gap-3 border border-border bg-card p-3.5 transition-colors ${
                        habilitado ? 'cursor-pointer hover:border-primary/60' : 'cursor-not-allowed opacity-55'
                      }`}
                      style={{ borderRadius: 'var(--gp-radius-md)' }}
                    >
                      <Checkbox
                        checked={marcado}
                        disabled={!habilitado || gerando !== null}
                        onCheckedChange={() => alternar(bloco.id)}
                        className="mt-0.5"
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
                <p
                  className="mt-3 p-3"
                  style={{
                    fontSize: 12,
                    lineHeight: '18px',
                    borderRadius: 'var(--gp-radius-md)',
                    background: 'var(--gp-brand-surface-soft)',
                    color: 'var(--gp-brand-strong)',
                  }}
                >
                  O arquivo vai conter nomes de alunos. Compartilhe apenas com quem tem finalidade
                  pedagógica e não publique em canais abertos.
                </p>
              )}
            </div>

            <div
              className="sticky bottom-0 flex flex-col gap-3 border-t border-border px-6 py-5"
              style={{ background: 'var(--gp-surface-1)' }}
            >
              <p style={{ fontSize: 12.5, color: 'var(--gp-text-3)' }}>
                {escolhidos.length === 0
                  ? 'Selecione ao menos um bloco para exportar.'
                  : `${escolhidos.length} ${escolhidos.length === 1 ? 'bloco selecionado' : 'blocos selecionados'}${
                      carregandoExtras ? ' · carregando dados…' : ''
                    }`}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {FORMATOS.map((formato) => (
                  <button
                    key={formato.id}
                    type="button"
                    data-testid={`exportar-${formato.id}`}
                    disabled={gerando !== null || escolhidos.length === 0 || carregandoExtras}
                    onClick={() => void gerar(formato.id)}
                    className="group flex items-center gap-3 border border-border bg-card p-3.5 text-left transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-55"
                    style={{
                      borderRadius: 'var(--gp-radius-md)',
                      boxShadow: 'var(--gp-shadow-card)',
                      transitionDuration: 'var(--gp-motion-2)',
                      transitionTimingFunction: 'var(--gp-ease)',
                    }}
                  >
                    <span
                      className="flex flex-none items-center justify-center"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 'var(--gp-radius-sm)',
                        background: 'var(--gp-surface-3)',
                        color: 'var(--gp-text-2)',
                      }}
                    >
                      <Icon name={formato.id === 'pdf' ? 'documents' : 'download'} variant="filled" size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gp-text-1)' }}>
                        {gerando === formato.id ? 'Gerando…' : formato.titulo}
                      </span>
                      <span
                        className="block"
                        style={{ fontSize: 12, lineHeight: '17px', marginTop: 1, color: 'var(--gp-text-3)' }}
                      >
                        {formato.descricao}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => onAbertoChange(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
