import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { ESTILO_CONTROLE } from '@/features/gestor/components/engajamento/FiltroPeriodo';

/**
 * Botão "Exportar" do cabeçalho (spec §12.1, D11/P16): CSV com os números
 * agregados da aba atual, sem dado pessoal e portanto sem depender de
 * `podeExportar`.
 *
 * Nesta etapa só o botão existe. Sem `onExportar` ele fica desabilitado: o
 * conteúdo do CSV (as seções de cada aba) entra na tarefa B13, quando os dados
 * de cada aba já estiverem carregados na tela.
 */
export function BotaoExportarAba({ onExportar }: { onExportar?: () => void }) {
  return (
    <button
      type="button"
      onClick={onExportar}
      disabled={!onExportar}
      className="inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ ...ESTILO_CONTROLE, fontWeight: 600 }}
    >
      <Icon name="download" size={16} />
      Exportar
    </button>
  );
}
