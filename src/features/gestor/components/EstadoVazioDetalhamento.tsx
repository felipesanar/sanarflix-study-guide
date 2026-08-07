import { Button } from '@/components/ui/button';
import { Icon } from '@/features/gestor/components/Icon';

interface EstadoVazioDetalhamentoProps {
  /**
   * Devolve o foco ao gatilho do `SeletorSimulados`. Sem ela a ação primária
   * não é renderizada — um botão que não leva a lugar nenhum é pior que a
   * ausência dele, e o chamador (`routes/Detalhamento.tsx`) é quem tem a ref
   * do seletor.
   */
  aoSelecionar?: () => void;
}

/**
 * Vazio da tela de Detalhamento com 0 simulados selecionados (§4.7.1).
 *
 * Anatomia da referência: tile de 56px com `insights-outlined` a 26px, título
 * "Selecione um simulado", uma linha de apoio e UMA ação primária. Não é o
 * `EstadoVazio` compartilhado porque este é o vazio de TELA (56px/26px, ação
 * primária de marca), não o vazio de bloco (36px/18px, ação de saída
 * contornada).
 */
export function EstadoVazioDetalhamento({ aoSelecionar }: EstadoVazioDetalhamentoProps = {}) {
  return (
    <section
      data-testid="detalhamento-vazio"
      aria-labelledby="detalhamento-vazio-titulo"
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-9 text-center"
    >
      <span
        aria-hidden="true"
        className="mb-1 inline-flex shrink-0 items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: 'var(--gp-radius-lg)',
          background: 'var(--gp-brand-surface)',
          color: 'var(--gp-brand-on-dark, var(--gp-brand))',
        }}
      >
        <Icon name="insights" size={26} />
      </span>

      <h2 id="detalhamento-vazio-titulo" className="text-base font-semibold text-foreground">
        Selecione um simulado
      </h2>
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        Visualize questões, alunos e desempenho por recorte. Compare 2 ou mais lado a lado; não há
        leitura de todos — para o agregado do período, use a Visão Geral.
      </p>

      {aoSelecionar && (
        <Button className="mt-2 h-auto rounded-sm px-4 py-2 text-sm font-semibold" onClick={aoSelecionar}>
          Selecionar simulado
        </Button>
      )}
    </section>
  );
}
