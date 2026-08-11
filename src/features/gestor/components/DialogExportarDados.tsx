import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { useToast } from '@/hooks/use-toast';
import { useGestorContexto, useVisaoGeral } from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { useTelemetriaGestor } from '@/features/gestor/lib/telemetria';
import { exportarRecorte, type FormatoExport } from '@/features/gestor/lib/exportarRecorte';
import type { FiltroSemestre } from '@/features/gestor/api/types';

/** Mesma nomenclatura do `FiltroSemestre` da tela — o arquivo não pode chamar o recorte de outro nome. */
export function rotuloRecorteSemestre(semestre: FiltroSemestre): string {
  if (semestre === '6ano') return '6º ano';
  if (semestre === 'geral') return 'Geral (todos os semestres)';
  return `${semestre}º período`;
}

interface OpcaoFormato {
  id: FormatoExport;
  titulo: string;
  descricao: string;
  icone: 'documents' | 'download';
}

const FORMATOS: OpcaoFormato[] = [
  {
    id: 'pdf',
    titulo: 'PDF',
    descricao: 'Relatório pronto para ler e circular na coordenação.',
    icone: 'documents',
  },
  {
    id: 'xlsx',
    titulo: 'Excel (XLSX)',
    descricao: 'Planilha formatada, uma aba por bloco, para continuar a análise.',
    icone: 'download',
  },
];

export interface DialogExportarDadosProps {
  aberto: boolean;
  onAbertoChange: (aberto: boolean) => void;
  iesId: string;
}

/**
 * "Exportar dados" — terceira opção do Início (pedido de 11/08). O arquivo é
 * montado no cliente a partir do MESMO dado da Visão Geral (`useVisaoGeral`),
 * sem consulta nova e sem ampliar o que o papel já podia ver. Só agregados:
 * nenhuma lista nominal de aluno entra no arquivo (handoff §7.7).
 */
export function DialogExportarDados({ aberto, onAbertoChange, iesId }: DialogExportarDadosProps) {
  const { toast } = useToast();
  const { semestre, simulados } = useFiltrosGestor();
  const { data: contexto } = useGestorContexto();
  const { exportSolicitado } = useTelemetriaGestor();
  const [gerando, setGerando] = React.useState<FormatoExport | null>(null);

  const {
    data: visaoGeral,
    meta,
    isLoading,
    isError,
    refetch,
  } = useVisaoGeral({ iesId: aberto ? iesId : null, semestre, simulados });

  const iesNome =
    contexto?.iesDisponiveis.find((ies) => ies.id === iesId)?.nome ?? contexto?.iesAtual.nome ?? '';
  const semestreRotulo = rotuloRecorteSemestre(semestre);

  const gerar = async (formato: FormatoExport) => {
    if (!visaoGeral) return;
    setGerando(formato);
    try {
      const arquivo = exportarRecorte(formato, { iesNome, semestreRotulo, visaoGeral, meta });
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
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="sm:max-w-[520px]" data-testid="dialog-exportar-dados">
        <DialogHeader>
          <DialogTitle style={{ fontSize: 18, fontWeight: 700 }}>Exportar dados</DialogTitle>
          <DialogDescription>
            {iesNome ? `${iesNome} · ` : ''}
            {semestreRotulo}. O arquivo leva os números agregados deste recorte — indicadores,
            evolução, acerto por grande área e distribuição de alunos. Sem dados nominais de aluno.
          </DialogDescription>
        </DialogHeader>

        {isError ? (
          <EstadoErro
            titulo="Não foi possível carregar os dados do recorte."
            descricao="Sem eles o arquivo sairia incompleto."
            onRetry={refetch}
          />
        ) : isLoading || !visaoGeral ? (
          <GestorSkeleton altura={132} rotulo="Carregando dados do recorte" />
        ) : (
          <div className="flex flex-col gap-3">
            {FORMATOS.map((formato) => (
              <button
                key={formato.id}
                type="button"
                data-testid={`exportar-${formato.id}`}
                disabled={gerando !== null}
                onClick={() => void gerar(formato.id)}
                className="group flex items-center gap-4 border border-border bg-card p-4 text-left transition-[transform,box-shadow,border-color] hover:-translate-y-px hover:border-primary hover:[box-shadow:0_12px_28px_-14px_hsl(var(--primary)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
                style={{
                  borderRadius: 'var(--gp-radius-lg)',
                  boxShadow: 'var(--gp-shadow-card)',
                  transitionDuration: 'var(--gp-motion-2)',
                  transitionTimingFunction: 'var(--gp-ease)',
                }}
              >
                <span
                  className="flex flex-none items-center justify-center"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 'var(--gp-radius-md)',
                    background: 'var(--gp-surface-3)',
                    color: 'var(--gp-text-2)',
                  }}
                >
                  <Icon name={formato.icone} variant="filled" size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block"
                    style={{ fontSize: 15, fontWeight: 700, color: 'var(--gp-text-1)' }}
                  >
                    {formato.titulo}
                  </span>
                  <span
                    className="block"
                    style={{ fontSize: 13, lineHeight: '19px', marginTop: 2, color: 'var(--gp-text-3)' }}
                  >
                    {formato.descricao}
                  </span>
                </span>
                <span className="flex flex-none items-center" style={{ color: 'var(--gp-border-input)' }}>
                  <Icon name="download" size={20} />
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onAbertoChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
