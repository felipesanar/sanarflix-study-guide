import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AcoesRecorte } from '@/features/gestor/components/AcoesRecorte';
import type { RecorteDiagnostico } from '@/features/gestor/components/CascataDiagnostico';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { useDiagnosticoTemas } from '@/features/gestor/api/queries';
import { formatPct } from '@/features/gestor/lib/formatters';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import type { FiltrosGestor } from '@/features/gestor/api/types';
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

  if (!especialidade) return null;

  const temas = consulta.data ?? [];

  /**
   * §7.7: o texto do "Copiar resumo" é AGREGADO por tema — nunca lista
   * nominal de aluno. Montado aqui e entregue pronto ao `AcoesRecorte`, cuja
   * assinatura (`resumoTexto: string`) é a própria barreira: ele não recebe
   * lista de alunos e portanto não pode montar uma.
   */
  const resumoTexto = [
    `Temas de ${especialidade.nome} — percentual de acerto`,
    ...temas.map((tema) => `${tema.nome}: ${formatPct(tema.acertoPct)} (amostra: ${tema.amostra})`),
  ].join('\n');

  return (
    <Sheet
      open
      onOpenChange={(aberto) => {
        if (!aberto) onFechar();
      }}
    >
      <SheetContent container={container} side="right" className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Temas de {especialidade.nome}</SheetTitle>
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
            <ul className="space-y-3">
              {temas.map((tema) => (
                <li key={tema.id} data-testid={`tema-${tema.id}`} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{tema.nome}</span>
                      {tema.lowSample ? (
                        <Badge variant="outline" className="shrink-0 gap-1 text-[10px] font-medium">
                          cobertura parcial
                          <span className="text-muted-foreground">n = {tema.amostra}</span>
                        </Badge>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatPct(tema.acertoPct)}</span>
                  </div>
                  <div
                    data-testid={`barra-${tema.id}`}
                    role="progressbar"
                    aria-label={`Percentual de acerto em ${tema.nome}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(tema.acertoPct)}
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${tema.acertoPct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
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
      </SheetContent>
    </Sheet>
  );
}
