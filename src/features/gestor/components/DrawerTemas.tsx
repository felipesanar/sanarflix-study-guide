import * as React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AcoesRecorte } from '@/features/gestor/components/AcoesRecorte';
import type { RecorteDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { TagCoberturaParcial } from '@/features/gestor/components/Tag';
import { useDiagnosticoTemas } from '@/features/gestor/api/queries';
import { formatPct } from '@/features/gestor/lib/formatters';
import { nivelDesempenho } from '@/features/gestor/lib/regras';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import type { FiltrosGestor, TemaCritico } from '@/features/gestor/api/types';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';

/**
 * Especialidade selecionada na cascata do Diagnóstico Curricular (Task 42),
 * enriquecida com a grande área do nó PAI que originou o clique.
 *
 * `CascataDiagnostico.onAbrirTemas` repassa `grandeArea` direto do `node` do
 * nível que contém a especialidade (o pai que originou o clique) — nunca
 * `undefined`/string vazia; `NivelCascata` guarda essa invariante em runtime
 * (ver comentário sobre `abrirTemas` em `CascataDiagnostico.tsx`). Por isso
 * este objeto pode ser passado direto de `onAbrirTemas` para
 * `setEspecialidadeAberta`/`DrawerTemas`, sem enriquecimento por fora — quem
 * compõe a tela (`VisaoGeral.tsx`) só precisa repassar o valor recebido.
 *
 * `id`/`nome` de um nó são o mesmo texto (`get_gestor_diagnostico.sql`: "id
 * do nó é o próprio nome, porque é a chave que volta como
 * p_node/p_especialidade na chamada seguinte") — e o mesmo vale para
 * `grandeArea`: é o texto de `questoes_simulado.grande_area`, o MESMO valor
 * já usado como `p_node` para buscar as especialidades daquela grande área
 * um nível acima na cascata.
 */
export interface EspecialidadeSelecionada {
  id: string;
  nome: string;
  grandeArea: string;
}

export interface DrawerTemasProps {
  especialidade: EspecialidadeSelecionada | null;
  recorte: RecorteDiagnostico;
  onFechar: () => void;
  onExportarRecorte: (escopo: string) => void;
}

/**
 * Cor de preenchimento da barra do tema. A cor é REFORÇO do número já
 * impresso ao lado — nunca o único canal — e vem da mesma régua que
 * classifica a cascata (`lib/regras.ts`), nunca de um corte reescrito aqui.
 *
 * Amostra pequena recua para o tom neutro de propósito: onde não se deve
 * confiar no valor, a barra não deve gritar severidade.
 */
function corDaBarra(tema: TemaCritico): string {
  if (tema.lowSample) return 'var(--gp-text-3)';
  switch (nivelDesempenho(tema.acertoPct)) {
    case 'critico':
      return 'var(--gp-danger)';
    case 'mediano':
      return 'var(--gp-warning)';
    default:
      return 'var(--gp-success)';
  }
}

/**
 * Último nível da hierarquia do Diagnóstico Curricular (spec §4.9): tema, em
 * % de acerto — tema e especialidade nunca usam a escala de proficiência
 * (§4.1, "Nota TRI" não existe como métrica).
 *
 * `get_gestor_diagnostico_temas` agora EXIGE `p_grande_area`
 * (`20260804163000_get_gestor_diagnostico_temas_grande_area_obrigatoria.sql`):
 * sem ela a RPC lança `grande_area_obrigatoria` em vez de somar, em
 * silêncio, os temas de duas grandes áreas homônimas (achado 11/115 da
 * revisão de 03/08). Por isso `especialidade.grandeArea` é campo
 * OBRIGATÓRIO nesta prop, nunca opcional — e é repassado ao hook tal como
 * recebido, nunca substituído por `null`.
 *
 * O vazio aqui é comum, pela mesma razão do vazio do grupo crítico na
 * cascata (corte de 30% de acerto, Task 42): reusa `EstadoVazio`, nunca um
 * gráfico zerado.
 */
export function DrawerTemas({ especialidade, recorte, onFechar, onExportarRecorte }: DrawerTemasProps) {
  const filtros: FiltrosGestor = { iesId: recorte.iesId, semestre: recorte.semestre, simulados: [] };
  const consulta = useDiagnosticoTemas(filtros, especialidade?.id ?? null, especialidade?.grandeArea ?? null);
  useDevolverFocoAoFechar(especialidade !== null);
  const container = useGestorPortalContainer();
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  if (!especialidade) return null;

  const temas = consulta.data ?? [];
  const meta = consulta.meta;

  /**
   * §7.7: o texto do "Copiar resumo" é AGREGADO por tema — nunca lista
   * nominal de aluno. Montado aqui e entregue pronto ao `AcoesRecorte`, cuja
   * assinatura (`resumoTexto: string`) é a própria barreira: ele não recebe
   * lista de alunos e portanto não pode montar uma.
   */
  const resumoTexto = [
    `Temas de ${especialidade.nome} — percentual de acerto`,
    ...temas.map((tema) => `${tema.nome}: ${formatPct(tema.acertoPct)} (${tema.respostas} respostas)`),
  ].join('\n');

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <SheetContent
        container={container}
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md"
        /*
          Fechar do PORTAL, não o do shadcn: o `X` do Lucide é de outra família
          de ícones (handoff §3 exige 100% Fontello do Dendê) e anunciava
          "Close" num portal inteiro em pt-BR. O scrim segue o mesmo caminho —
          `bg-black/80` é opaco demais para o tema claro do gestor, e
          `--gp-scrim` é o token que o `gestor-theme.css` calibra por tema.
        */
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        closeClassName="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-[color:var(--gp-border-strong)] text-[color:var(--gp-text-3)] opacity-100"
        overlayClassName="bg-[var(--gp-scrim)]"
        /*
          Handoff §11: "o foco vai para o TÍTULO ao abrir". Sem isto o
          FocusScope do Radix manda o foco ao primeiro tabulável do conteúdo —
          o "Exportar recorte" do rodapé — e quem usa leitor de tela entra no
          drawer já no fim dele, sem ouvir de que especialidade se trata.
        */
        onOpenAutoFocus={(evento) => {
          evento.preventDefault();
          tituloRef.current?.focus();
        }}
      >
        <SheetHeader>
          {/*
            Cabeçalho em dois níveis: sobrelinha com a GRANDE ÁREA e título com
            a especialidade. Duas especialidades homônimas em grandes áreas
            diferentes (o motivo de `grandeArea` ter virado obrigatório) abriam
            drawers visualmente idênticos.

            O nome acessível do diálogo continua sendo a frase inteira — o
            fragmento visual é `aria-hidden` e o texto para leitor de tela vem
            do `sr-only`, para que o par "Temas de X" não se perca na quebra
            em duas linhas.
          */}
          <SheetTitle ref={tituloRef} tabIndex={-1} className="outline-none">
            <span className="sr-only">
              Temas de {especialidade.nome} em {especialidade.grandeArea}
            </span>
            <span aria-hidden="true" className="block" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
              {especialidade.grandeArea}
            </span>
            <span aria-hidden="true" className="block" style={{ fontSize: 15, fontWeight: 700 }}>
              {especialidade.nome}
            </span>
          </SheetTitle>
          <SheetDescription>
            Percentual de acerto por tema. Tema e especialidade nunca usam a escala de proficiência.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1">
          {consulta.isLoading ? (
            <div className="space-y-2">
              <GestorSkeleton altura={40} rotulo="Carregando temas" />
              <GestorSkeleton altura={40} rotulo="Carregando temas" />
              <GestorSkeleton altura={40} rotulo="Carregando temas" />
            </div>
          ) : consulta.isError ? (
            <EstadoErro titulo="Não foi possível carregar os temas." onRetry={consulta.refetch} />
          ) : temas.length === 0 ? (
            <div data-testid="temas-vazio">
              <EstadoVazio titulo="Sem temas com resultado neste recorte" />
            </div>
          ) : (
            <>
              <p
                className="mb-2 uppercase"
                style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--gp-text-3)' }}
              >
                Temas · índice de acerto
              </p>
              <ul className="space-y-2.5">
                {temas.map((tema) => (
                  <li
                    key={tema.id}
                    data-testid={`tema-${tema.id}`}
                    className="border border-border p-3"
                    style={{ borderRadius: 'var(--gp-radius-md)' }}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold">{tema.nome}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatPct(tema.acertoPct)} acerto
                      </span>
                    </div>
                    <div
                      data-testid={`barra-${tema.id}`}
                      role="progressbar"
                      aria-label={`Percentual de acerto em ${tema.nome}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(tema.acertoPct)}
                      className="mt-2 w-full overflow-hidden"
                      style={{
                        height: 6,
                        borderRadius: 'var(--gp-radius-pill)',
                        background: 'var(--gp-surface-3)',
                      }}
                    >
                      <div
                        className="h-full"
                        style={{
                          width: `${tema.acertoPct}%`,
                          borderRadius: 'var(--gp-radius-pill)',
                          background: corDaBarra(tema),
                        }}
                      />
                    </div>
                    {/* A amostra é metadado de TODO tema, não só do de baixa
                        cobertura: sem ela o gestor não sabe sobre quantas
                        respostas o percentual foi calculado. */}
                    <div className="mt-2 flex items-center gap-2">
                      {tema.lowSample ? <TagCoberturaParcial n={tema.amostra} /> : null}
                      <span
                        data-testid={`amostra-${tema.id}`}
                        className="ml-auto whitespace-nowrap"
                        style={{ fontSize: 11, color: 'var(--gp-text-3)' }}
                      >
                        {tema.respostas} respostas
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/*
          Rodapé de ações via `AcoesRecorte` (Task 45b), NUNCA botões locais:
          é ele quem aplica o gate de `podeExportar` — capability resolvida no
          SERVIDOR (`get_gestor_contexto`), nunca role lida no cliente. Sem a
          capability, as duas ações ficam ausentes, não desabilitadas: um botão
          cinza com tooltip anunciaria ao gestor algo que a IES não contratou.
        */}
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <AcoesRecorte
            escopo={especialidade.nome}
            resumoTexto={resumoTexto}
            onExportar={() => onExportarRecorte(`especialidade:${especialidade.id}`)}
          />
        </div>

        {/* Proveniência do recorte — vem do `meta` do envelope (mesma fonte do
            TooltipRastreabilidade), nunca de texto fixo: quem exporta precisa
            saber de que agregado o número saiu. A data fica de fora de
            propósito: quem a apresenta (já convertida para Brasília) é o
            TooltipRastreabilidade, e duas renderizações da mesma data se
            contradiriam na virada do dia. */}
        {meta ? (
          <p data-testid="temas-proveniencia" style={{ fontSize: 11, color: 'var(--gp-text-3)' }}>
            agregado de {meta.periodo} · fonte: {meta.fonte}
          </p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
