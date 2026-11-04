import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { Tag } from '@/features/gestor/components/Tag';
import { formatData } from '@/features/gestor/lib/formatters';
import { mensagemErro } from '@/features/mentor/api/erros';
import { botaoSecundario, estiloBloco, estiloKicker, h2Bloco } from './estilos';
import { useDiagnosticoIa, type DiagnosticoIa as Diagnostico } from './useDiagnosticoIa';

export interface DiagnosticoIaProps {
  modalidade: 'b2c' | 'b2b';
  simulados: string[];
  /** "4º e 5º". */
  recorte: string;
  /** Abre o Mural (B2C) / Canais (B2B) preenchido para a turma toda. */
  onLevarMural: (d: Diagnostico) => void;
  onToast: (texto: string) => void;
}

/** "21/09" a partir do ISO; null quando a fonte não disse quando gerou. */
function diaMes(iso: string | null): string | null {
  const d = iso ? formatData(iso) : null;
  return d && d !== '—' ? d.slice(0, 5) : null;
}

/**
 * Diagnóstico da IA (docs/02 § Tela 3 · 5): mesma anatomia de estados do card de IA do `BlocoInsights`
 * do Gestor (skeleton de 3 linhas com `role="status"` durante a geração, erro contido no bloco com
 * "Tentar novamente"), com o cabeçalho, as ações e os textos do protótipo do mentor.
 */
export function DiagnosticoIa({ modalidade, simulados, recorte, onLevarMural, onToast }: DiagnosticoIaProps) {
  const ia = useDiagnosticoIa(modalidade, simulados);
  const atualizado = diaMes(ia.data?.geradoEm ?? null);
  const pronto = !ia.gerando && !ia.erro && ia.data;

  const gerarDeNovo = async () => {
    try {
      await ia.gerarDeNovo();
      onToast('Diagnóstico gerado de novo');
    } catch (e) {
      onToast(mensagemErro(e));
    }
  };

  return (
    <section aria-labelledby="ia-h" data-testid="bloco-diagnostico-ia" className="flex min-w-0 flex-col gap-3" style={{ ...estiloBloco, flex: '1 1 320px' }}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center" style={{ borderRadius: 8, background: 'var(--gp-brand-surface)', color: '#941F1F' }}>
          <Icon name="auto_awesome" size={16} />
        </span>
        <div className="flex flex-col gap-px">
          <h2 id="ia-h" style={h2Bloco}>Diagnóstico da IA</h2>
          <span style={{ fontSize: 12, color: 'var(--gp-text-3)' }}>
            {recorte} simulados{atualizado ? ` · atualizado em ${atualizado}` : ''}
          </span>
        </div>
      </div>
      <Tag variant="contador" className="self-start" style={{ padding: '2px 7px', fontSize: 11 }}>gerado por IA</Tag>

      {ia.gerando ? (
        <div className="flex flex-col gap-2" role="status" aria-live="polite" aria-busy="true" data-testid="ia-gerando">
          <GestorSkeleton altura={12} rotulo="Gerando diagnóstico" />
          <GestorSkeleton altura={12} rotulo="Gerando diagnóstico" className="w-4/5" />
          <GestorSkeleton altura={12} rotulo="Gerando diagnóstico" className="w-[65%]" />
          <span className="sr-only">Gerando diagnóstico…</span>
        </div>
      ) : ia.erro ? (
        <div role="alert" className="flex flex-col items-start gap-1.5">
          <p style={{ fontSize: 13, color: 'var(--gp-danger-on)' }}>Não foi possível gerar o diagnóstico agora. {mensagemErro(ia.erro)}</p>
          <button type="button" onClick={ia.tentarNovamente} style={botaoSecundario}>Tentar novamente</button>
        </div>
      ) : pronto && ia.data ? (
        <>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: 'var(--gp-text-1)', textWrap: 'pretty' as never }}>{ia.data.resumo}</p>
          {ia.data.itens.length > 0 ? (
            <>
              <span style={{ ...estiloKicker, letterSpacing: '0.08em' }}>O que olhar primeiro</span>
              <ol className="flex list-decimal flex-col gap-2 pl-[18px]" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--gp-text-2)' }}>
                {ia.data.itens.map((i) => (
                  <li key={`${i.destaque}-${i.texto}`}><b style={{ color: 'var(--gp-text-1)' }}>{i.destaque}</b> {i.texto}</li>
                ))}
              </ol>
            </>
          ) : null}
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-2.5" style={{ borderTop: '1px solid var(--gp-border-subtle)' }}>
        <span className="min-w-[160px] flex-1" style={{ fontSize: 11.5, color: 'var(--gp-text-3)' }}>Revise antes de compartilhar.</span>
        <button
          type="button"
          onClick={() => void gerarDeNovo()}
          disabled={ia.gerando}
          className="inline-flex items-center gap-1 whitespace-nowrap disabled:opacity-60"
          style={{ color: '#941F1F', fontWeight: 600, fontSize: 12.5 }}
        >
          <Icon name="refresh" size={13} />
          Gerar de novo
        </button>
        <button
          type="button"
          onClick={() => ia.data && onLevarMural(ia.data)}
          disabled={!pronto}
          className="inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
          style={botaoSecundario}
        >
          <Icon name="campaign" size={13} />
          Levar pro mural
        </button>
      </div>
    </section>
  );
}
