import { useEffect, useId, useRef, useState } from 'react';
import { EstadoErro } from '@/features/gestor/components/EstadoErro';
import { EstadoVazio } from '@/features/gestor/components/EstadoVazio';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { mensagemErro } from '../../api/erros';
import { useCanais, useMarcarRotinaEnviada, useMe, useRotina, useSalvarGrupoTribo } from '../../api/queries';
import type { ItemRotinaAcademy } from '../../api/types';
import { ehLinkHttps } from '../../lib/linkSeguro';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, BOTAO_TEXTO, CAMPO, CARTAO, TEXTO_ERRO } from './estilo';
import {
  ROTULO_ROTINA,
  intervaloSemana,
  normalizarLinkGrupo,
  podeMarcar,
  rotuloDiaLongo,
  rotuloSituacao,
  situacaoItem,
  type SituacaoRotina,
} from './regras';

const ERRO_LINK = 'Use um link de convite do WhatsApp (chat.whatsapp.com/…).';

const COR_SITUACAO: Record<SituacaoRotina, string> = {
  enviado: 'var(--gp-success-on)',
  hoje: 'var(--gp-warning-on)',
  atrasado: 'var(--gp-warning-on)',
  amanha: 'var(--gp-text-2)',
  futuro: 'var(--gp-text-2)',
};

export interface RotinaWhatsAppProps {
  /** Segunda-feira da semana (YYYY-MM-DD). */
  semana: string;
  /** Hoje em São Paulo (YYYY-MM-DD). */
  hoje: string;
  onToast: (mensagem: string) => void;
}

/**
 * Grupo de WhatsApp da IES com a rotina da semana (ter enquete · qui resposta · sex pérola).
 * O Academy não envia nada: o mentor envia no app e marca aqui (`mentor_rotina_marcar_enviado`),
 * o que alimenta o log da semana e o badge de Canais.
 */
export function RotinaWhatsApp({ semana, hoje, onToast }: RotinaWhatsAppProps) {
  const tituloId = useId();
  const me = useMe();
  const tribo = me.data?.tribos[0];
  const nomeIes = tribo?.iesNome ?? tribo?.nome ?? null;
  const rotina = useRotina(semana);
  const marcar = useMarcarRotinaEnviada();
  const [erroItem, setErroItem] = useState<{ id: string; msg: string } | null>(null);
  const statusRefs = useRef(new Map<string, HTMLSpanElement | null>());
  const [focarStatus, setFocarStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!focarStatus) return;
    const alvo = statusRefs.current.get(focarStatus);
    if (alvo) { alvo.focus(); setFocarStatus(null); }
  });

  const aoMarcar = (item: ItemRotinaAcademy) => {
    setErroItem(null);
    marcar.mutate(item.id, {
      onSuccess: () => {
        onToast(`${ROTULO_ROTINA[item.tipo]} marcada como enviada · entrou no log da semana`);
        setFocarStatus(item.id);
      },
      onError: (e) => setErroItem({ id: item.id, msg: mensagemErro(e) }),
    });
  };

  const itens = rotina.data ?? [];
  return (
    <section aria-labelledby={tituloId} className={`${CARTAO} grow-[2] shrink basis-[520px]`}>
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--gp-surface-2)] text-[var(--gp-text-1)]">
          <Icon name="whatsapp" size={18} />
        </span>
        <div className="flex min-w-[200px] flex-1 flex-col">
          <h2 id={tituloId} className="m-0 text-[15px] font-semibold">
            Grupo de WhatsApp{nomeIes ? ` · PRO ENAMED ${nomeIes}` : ''}
          </h2>
          <span className="text-[12.5px] text-[var(--gp-text-2)]">Rotina semanal de {intervaloSemana(semana)} · 1 enquete e 1 pérola por semana</span>
        </div>
        <LinkDoGrupo onToast={onToast} />
      </header>

      {rotina.isPending ? (
        <div className="border-t border-[var(--gp-border-subtle)] px-5 py-3">
          <GestorSkeleton altura={204} forma="cartao" rotulo="Carregando a rotina da semana" />
        </div>
      ) : rotina.isError ? (
        <div className="border-t border-[var(--gp-border-subtle)] p-4">
          <EstadoErro altura={180} descricao={mensagemErro(rotina.error)} onRetry={() => { void rotina.refetch(); }} tentandoNovamente={rotina.isFetching} />
        </div>
      ) : itens.length === 0 ? (
        <div className="border-t border-[var(--gp-border-subtle)] p-4">
          <EstadoVazio titulo="Sem rotina cadastrada nesta semana." glifo="calendar_month" compacto />
        </div>
      ) : (
        <ul className="m-0 list-none p-0">
          {itens.map((item) => {
            const s = situacaoItem(item, hoje);
            const enviando = marcar.isPending && marcar.variables === item.id;
            const erro = erroItem?.id === item.id ? erroItem.msg : null;
            return (
              <li
                key={item.id}
                className="flex items-start gap-3.5 border-t border-[var(--gp-border-subtle)] px-5 py-3.5"
                style={{ background: s === 'hoje' ? 'color-mix(in srgb, var(--gp-warning-surface) 40%, var(--gp-surface-1))' : undefined }}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={s === 'enviado'
                    ? { background: 'var(--gp-success)', color: 'var(--gp-surface-1)' }
                    : { background: 'var(--gp-surface-1)', border: '1.5px solid var(--gp-border-input)' }}
                >
                  {s === 'enviado' ? <Icon name="check" size={12} /> : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="break-words text-[13.5px]"><b className="font-semibold">{rotuloDiaLongo(item, s)}</b> · {ROTULO_ROTINA[item.tipo]}</span>
                  {item.conteudo.trim() ? <span className="break-words text-[12.5px] text-[var(--gp-text-2)]">{item.conteudo}</span> : null}
                  {erro ? <span role="alert" className={TEXTO_ERRO}>{erro}</span> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    ref={(el) => { statusRefs.current.set(item.id, el); }}
                    tabIndex={-1}
                    className="whitespace-nowrap text-xs font-semibold outline-none"
                    style={{ color: COR_SITUACAO[s] }}
                  >
                    {rotuloSituacao(s, item.dia)}
                  </span>
                  {podeMarcar(s) ? (
                    <button
                      type="button"
                      className={`${BOTAO_SECUNDARIO} h-[30px] px-2.5 text-[12.5px]`}
                      onClick={() => aoMarcar(item)}
                      disabled={enviando}
                      aria-busy={enviando || undefined}
                      aria-label={`Marcar como enviado: ${ROTULO_ROTINA[item.tipo]}`}
                    >
                      Marcar como enviado
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="m-0 border-t border-[var(--gp-border-subtle)] px-5 py-3 text-xs text-[var(--gp-text-3)]">Envie como seu, sem "encaminhar".</p>
    </section>
  );
}

/** "Abrir grupo ↗" (link externo) e a edição do link do grupo da turma, o único canal que o mentor edita. */
function LinkDoGrupo({ onToast }: { onToast: (m: string) => void }) {
  const canais = useCanais();
  const salvar = useSalvarGrupoTribo();
  const grupo = canais.data?.find((c) => c.tipo === 'grupo_turma') ?? null;
  const url = grupo && ehLinkHttps(grupo.url) ? grupo.url : null;
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const campoRef = useRef<HTMLInputElement>(null);
  const gatilhoRef = useRef<HTMLButtonElement>(null);
  const erroId = useId();

  useEffect(() => { if (editando) campoRef.current?.focus(); }, [editando]);

  if (canais.isPending || canais.isError || !grupo) return null;

  const fechar = () => { setEditando(false); setErro(null); requestAnimationFrame(() => gatilhoRef.current?.focus()); };
  const aoSalvar = () => {
    const link = normalizarLinkGrupo(valor);
    if (!link) { setErro(ERRO_LINK); return; }
    salvar.mutate(link, {
      onSuccess: () => { fechar(); onToast('Link do grupo atualizado na página dos alunos'); },
      onError: (e) => setErro(mensagemErro(e)),
    });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${editando ? 'w-full basis-full' : ''}`}>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
          Abrir grupo<Icon name="open_in_new" size={13} /><span className="sr-only"> (abre em nova aba)</span>
        </a>
      ) : null}
      {grupo.editavel && !editando ? (
        <button
          ref={gatilhoRef}
          type="button"
          className={`${BOTAO_TEXTO} h-[30px] text-[12.5px]`}
          onClick={() => { setValor(grupo.url); setErro(null); setEditando(true); }}
        >
          {url ? 'Editar link' : 'Cadastrar link'}
        </button>
      ) : null}
      {editando ? (
        <form
          className="flex w-full basis-full flex-wrap items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); aoSalvar(); }}
        >
          <input
            ref={campoRef}
            value={valor}
            onChange={(e) => { setValor(e.target.value); setErro(null); }}
            onKeyDown={(e) => { if (e.key === 'Escape') fechar(); }}
            aria-label="Link do grupo da turma"
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? erroId : undefined}
            placeholder="chat.whatsapp.com/…"
            className={`${CAMPO} h-8 min-w-0 flex-1 basis-[220px] text-[13px]`}
            style={{ borderColor: erro ? 'var(--gp-danger)' : 'var(--gp-border-input)' }}
          />
          <button type="submit" className={`${BOTAO_PRIMARIO} h-8 text-[12.5px]`} disabled={salvar.isPending}>Salvar</button>
          <button type="button" className={`${BOTAO_TEXTO} h-8 text-[12.5px]`} onClick={fechar}>Cancelar</button>
          {erro ? <span id={erroId} role="alert" className={`${TEXTO_ERRO} basis-full`}>{erro}</span> : null}
        </form>
      ) : null}
    </div>
  );
}
