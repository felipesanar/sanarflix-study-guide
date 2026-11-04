import { useEffect, useId, useRef, useState } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '../../api/erros';
import { dataHoraSp, ROTULO_TAG } from '../../api/fonteAcademy';
import { useMe, useMural, usePublicar } from '../../api/queries';
import type { TagMural } from '../../api/types';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, BOTAO_TEXTO, CAMPO, CARTAO, FOCO, TEXTO_ERRO } from './estilo';
import { ddmm } from './regras';

const TAGS: TagMural[] = ['desempenho', 'aviso', 'fique_por_dentro'];
export const ERRO_OBRIGATORIOS = 'Título e mensagem são obrigatórios.';
/** Quantas publicações recentes o bloco lista. */
export const HISTORICO_MAX = 3;

export interface RascunhoMural {
  tag?: TagMural;
  titulo?: string;
  mensagem?: string;
}

export interface MuralCanaisProps {
  /** Deep link (Diagnóstico/questão → Canais): abre o composer já preenchido. */
  inicial?: RascunhoMural | null;
  onToast: (mensagem: string) => void;
}

/** Mural no Academy, versão B2B: composer curto para a turma toda + últimas publicações. */
export function MuralCanais({ inicial, onToast }: MuralCanaisProps) {
  const tituloId = useId();
  const formId = useId();
  const erroId = useId();
  const me = useMe();
  const total = me.data?.tribos[0]?.totalAlunos ?? null;
  const mural = useMural({ status: 'publicada' });
  const publicar = usePublicar();

  const [aberto, setAberto] = useState(!!inicial);
  const [tag, setTag] = useState<TagMural>(inicial?.tag ?? 'fique_por_dentro');
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '');
  const [mensagem, setMensagem] = useState(inicial?.mensagem ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const tituloRef = useRef<HTMLInputElement>(null);
  const novaRef = useRef<HTMLButtonElement>(null);
  const devolverFoco = useRef(false);

  useEffect(() => {
    if (aberto) tituloRef.current?.focus();
    else if (devolverFoco.current) { devolverFoco.current = false; novaRef.current?.focus(); }
  }, [aberto]);

  const fechar = () => { devolverFoco.current = true; setAberto(false); setErro(null); };
  const destino = total != null ? `${total}` : 'a turma';
  const aoPublicar = () => {
    if (!titulo.trim() || !mensagem.trim()) { setErro(ERRO_OBRIGATORIOS); return; }
    setErro(null);
    publicar.mutate(
      { pub: { tag, titulo: titulo.trim(), mensagem: mensagem.trim(), link: null, status: 'publicada', destino: { tipo: 'tribo' } }, registrarIntervencao: false },
      {
        onSuccess: () => {
          devolverFoco.current = true;
          setAberto(false);
          setTitulo('');
          setMensagem('');
          onToast(total != null ? `Publicado para ${total} alunos` : 'Publicado para a turma');
        },
        onError: (e) => setErro(mensagemErro(e)),
      },
    );
  };
  const faltaTitulo = erro === ERRO_OBRIGATORIOS && !titulo.trim();
  const faltaMensagem = erro === ERRO_OBRIGATORIOS && !mensagem.trim();
  const recentes = (mural.data?.data ?? []).filter((p) => p.status === 'publicada').slice(0, HISTORICO_MAX);

  return (
    <section aria-labelledby={tituloId} className={`${CARTAO} flex flex-col gap-2.5 px-5 py-4`}>
      <div className="flex items-center gap-2.5">
        <Icon name="campaign" size={17} />
        <h2 id={tituloId} className="m-0 flex-1 text-[15px] font-semibold">Mural no Academy</h2>
      </div>

      {aberto ? (
        <form id={formId} noValidate className="flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); aoPublicar(); }}>
          <div role="group" aria-label="Tag da publicação" className="flex flex-wrap gap-1.5">
            {TAGS.map((t) => {
              const ativo = t === tag;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setTag(t)}
                  className={`h-7 whitespace-nowrap rounded-full border px-2.5 text-[12.5px] font-semibold ${FOCO}`}
                  style={ativo
                    ? { borderColor: 'var(--gp-brand-border)', background: 'var(--gp-brand-surface-soft)', color: 'var(--gp-brand)' }
                    : { borderColor: 'var(--gp-border-strong)', background: 'var(--gp-surface-1)', color: 'var(--gp-text-2)' }}
                >
                  {ROTULO_TAG[t]}
                </button>
              );
            })}
          </div>
          <input
            ref={tituloRef}
            value={titulo}
            onChange={(e) => { setTitulo(e.target.value); setErro(null); }}
            placeholder="Título"
            aria-label="Título"
            aria-invalid={faltaTitulo || undefined}
            aria-describedby={erro ? erroId : undefined}
            className={`${CAMPO} h-9`}
            style={{ borderColor: faltaTitulo ? 'var(--gp-danger)' : 'var(--gp-border-input)' }}
          />
          <textarea
            value={mensagem}
            onChange={(e) => { setMensagem(e.target.value); setErro(null); }}
            rows={3}
            placeholder={total != null ? `Mensagem para os ${total} alunos` : 'Mensagem para a turma'}
            aria-label="Mensagem"
            aria-invalid={faltaMensagem || undefined}
            aria-describedby={erro ? erroId : undefined}
            className={`${CAMPO} resize-y py-2`}
            style={{ borderColor: faltaMensagem ? 'var(--gp-danger)' : 'var(--gp-border-input)' }}
          />
          {erro ? <span id={erroId} role="alert" className={TEXTO_ERRO}>{erro}</span> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={BOTAO_TEXTO} onClick={fechar}>Cancelar</button>
            <button type="submit" className={BOTAO_PRIMARIO} disabled={publicar.isPending} aria-busy={publicar.isPending || undefined}>
              Publicar para {destino}
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={novaRef}
          type="button"
          aria-expanded={false}
          aria-controls={formId}
          onClick={() => setAberto(true)}
          className={`${BOTAO_SECUNDARIO} self-start`}
        >
          <Icon name="add" size={14} />Nova publicação
        </button>
      )}

      {mural.isPending ? (
        <GestorSkeleton altura={96} rotulo="Carregando as últimas publicações" />
      ) : mural.isError ? (
        <EstadoErro altura={120} descricao={mensagemErro(mural.error)} onRetry={() => { void mural.refetch(); }} tentandoNovamente={mural.isFetching} />
      ) : recentes.length === 0 ? (
        <EstadoVazio titulo="Nenhuma publicação no mural ainda." glifo="campaign" compacto />
      ) : (
        <ul aria-label="Últimas publicações" className="m-0 flex list-none flex-col gap-2 p-0">
          {recentes.map((p) => (
            <li key={p.id} className="flex gap-2.5 border-t border-[var(--gp-border-subtle)] pt-2 text-[13px]">
              <span className="min-w-0 flex-1 break-words">
                {p.titulo}
                <span className="block text-xs text-[var(--gp-text-3)]">{ROTULO_TAG[p.tag]}</span>
              </span>
              <span className="text-xs tabular-nums text-[var(--gp-text-3)]">{p.publicadaEm ? ddmm(dataHoraSp(p.publicadaEm).data) : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
