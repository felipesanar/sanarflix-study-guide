import * as React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Icon } from '@/features/gestor/components/Icon';
import { linkWhatsAppAluno } from '@/features/gestor/components/DrawerAluno';
import { useDevolverFocoAoFechar } from '@/features/gestor/hooks/useDevolverFocoAoFechar';
import { useGestorPortalContainer } from '@/features/gestor/shell/GestorShell';
import type { AlunoFlix } from '../../api/fonte';
import type { Intervencao, StatusIntervencao } from '../../api/types';
import { mensagemErro } from '../../api/erros';
import { useAtualizarIntervencao, useCanais, useComentarIntervencao, useRegistrarEvento } from '../../api/queries';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, FOCO, INPUT } from './estilos';
import { Toast, type EstadoToast, type MostrarToast } from './Toast';
import {
  COLUNAS, ICONE_TIPO, ROTULO_PERFIL, ROTULO_STATUS, TRACO, alunoUnico, ddmmDeIso, historicoExibido, nomeDe, paraQuem, rotuloOrigem, rotuloTipo,
  type Modalidade,
} from './util';

interface Props {
  card: Intervencao;
  modalidade: Modalidade;
  alunos: readonly AlunoFlix[];
  onFechar: () => void;
  toast: EstadoToast | null;
  mostrarToast: MostrarToast;
}

/** Contexto do destino (protótipo: "Regrediu 5 p.p. · Em variação"), só com dado que existe. */
function contexto(card: Intervencao, aluno: AlunoFlix | undefined, nomes: ReadonlyMap<string, string>, modalidade: Modalidade): string {
  const ids = card.destino.alunoIds ?? [];
  const perfil = modalidade === 'b2b' && card.perfil ? ROTULO_PERFIL[card.perfil] : null;
  if (card.destino.turmaToda) return [perfil, ids.length ? `${ids.length} alunos` : null].filter(Boolean).join(' · ') || TRACO;
  if (ids.length > 1) {
    const primeiros = ids.slice(0, 3).map((e) => nomeDe(e, nomes)).join(', ');
    return [perfil, ids.length > 3 ? `${primeiros} e mais ${ids.length - 3}` : primeiros].filter(Boolean).join(' · ');
  }
  const atividade = aluno?.ultimaAtividadeEm ? `Última atividade em ${ddmmDeIso(aluno.ultimaAtividadeEm)}` : null;
  const meta = modalidade === 'b2c' && aluno?.meta ? `Meta: ${aluno.meta.instituicao}` : null;
  return [perfil, atividade, meta].filter(Boolean).join(' · ') || TRACO;
}

/** Drawer do card (captura b2c/17): status em segmented, WhatsApp, mural, histórico e comentário. */
export function DrawerCardIntervencao({ card, modalidade, alunos, onFechar, toast, mostrarToast }: Props) {
  const id = React.useId();
  useDevolverFocoAoFechar(true);
  const container = useGestorPortalContainer();
  const tituloRef = React.useRef<HTMLHeadingElement>(null);

  const atualizar = useAtualizarIntervencao();
  const comentarM = useComentarIntervencao();
  const registrar = useRegistrarEvento();
  const canais = useCanais();

  const [comentario, setComentario] = React.useState('');
  const [erroStatus, setErroStatus] = React.useState<string | null>(null);
  const [erroComentario, setErroComentario] = React.useState<string | null>(null);
  React.useEffect(() => { setComentario(''); setErroStatus(null); setErroComentario(null); }, [card.id]);

  const nomes = React.useMemo(() => new Map(alunos.map((a) => [a.email.toLowerCase(), a.nome])), [alunos]);
  const email = alunoUnico(card);
  const aluno = email ? alunos.find((a) => a.email.toLowerCase() === email.toLowerCase()) : undefined;
  const historico = historicoExibido(card);

  const mudarStatus = (status: StatusIntervencao) => {
    if (status === card.status || atualizar.isPending) return;
    setErroStatus(null);
    atualizar.mutate({ id: card.id, status }, {
      onSuccess: () => mostrarToast(`Intervenção movida para ${ROTULO_STATUS[status]}`),
      onError: (e) => setErroStatus(mensagemErro(e)),
    });
  };

  const enviarComentario = (e: React.FormEvent) => {
    e.preventDefault();
    const texto = comentario.trim();
    if (!texto || comentarM.isPending) return;
    setErroComentario(null);
    comentarM.mutate({ id: card.id, texto }, {
      onSuccess: () => { setComentario(''); mostrarToast('Comentário adicionado'); },
      onError: (err) => setErroComentario(mensagemErro(err)),
    });
  };

  // WhatsApp: aluno único → wa.me do aluno (registra no log); turma toda → grupo da turma.
  const grupoTurma = canais.data?.find((c) => c.tipo === 'grupo_turma' && c.url);
  let zap: { href: string; registrar: boolean } | null = null;
  let semZap = '';
  if (email) {
    const primeiro = (aluno?.nome ?? '').trim().split(/\s+/)[0];
    const href = linkWhatsAppAluno(aluno?.whatsapp, primeiro ? `Olá, ${primeiro}! ` : 'Olá! ');
    if (href) zap = { href, registrar: true };
    else semZap = 'Aluno sem WhatsApp cadastrado.';
  } else if (card.destino.turmaToda) {
    if (grupoTurma) zap = { href: grupoTurma.url, registrar: false };
    else semZap = 'Grupo da turma sem link cadastrado.';
  } else {
    semZap = 'WhatsApp disponível para um aluno ou para a turma toda.';
  }
  const abriuZap = () => {
    if (!zap?.registrar || !email) return;
    registrar.mutate({ tipo: 'whatsapp_aberto', alunoId: aluno?.alunoId ?? email }, {
      onSuccess: () => mostrarToast('WhatsApp aberto em nova aba · registrado no log'),
      onError: (err) => mostrarToast(mensagemErro(err), 'erro'),
    });
  };

  const emailsMural = card.destino.turmaToda ? [] : card.destino.alunoIds ?? [];
  const baseMural = modalidade === 'b2b' ? '/mentor/canais' : '/mentor/mural';
  const linkMural = emailsMural.length ? `${baseMural}?${new URLSearchParams({ para: emailsMural.join(',') }).toString()}` : baseMural;

  return (
    <Sheet open onOpenChange={(aberto) => { if (!aberto) onFechar(); }}>
      <SheetContent
        container={container}
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto bg-[var(--gp-surface-1)] px-6 py-5 sm:max-w-[480px]"
        style={{ boxShadow: '-28px 0 64px -30px rgba(0,0,0,0.42)' }}
        closeIcon={<Icon name="close" size={16} />}
        closeLabel="Fechar"
        closeClassName={`inline-flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] text-[var(--gp-text-1)] opacity-100 right-6 top-5 ${FOCO}`}
        overlayClassName="bg-[var(--gp-scrim)]"
        onOpenAutoFocus={(ev) => { ev.preventDefault(); tituloRef.current?.focus(); }}
      >
        <SheetHeader className="space-y-4 pr-11 text-left">
          <SheetDescription className="flex min-h-[34px] items-center gap-1.5 text-[12.5px] text-[var(--gp-text-2)]">
            <Icon name={ICONE_TIPO[card.tipo]} size={14} />
            {rotuloTipo(card.tipo, modalidade)} · {rotuloOrigem(card.origem)}
          </SheetDescription>
          <SheetTitle ref={tituloRef} tabIndex={-1} className="m-0 break-words text-lg font-bold leading-[1.3] text-[var(--gp-text-1)] outline-none">
            {card.titulo}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-0.5 rounded-[10px] bg-[var(--gp-surface-2)] p-3">
          <span className="break-words text-[13.5px] font-semibold text-[var(--gp-text-1)]">{paraQuem(card, nomes)}</span>
          <span className="text-[12.5px] text-[var(--gp-text-2)]">{contexto(card, aluno, nomes, modalidade)}</span>
        </div>
        {card.nota ? <p className="m-0 whitespace-pre-line break-words text-[13px] text-[var(--gp-text-2)]">{card.nota}</p> : null}

        <div className="flex flex-col gap-1.5">
          <span id={`${id}-status`} className="text-[12.5px] font-semibold text-[var(--gp-text-2)]">Status</span>
          <div role="group" aria-labelledby={`${id}-status`} className="flex gap-0.5 rounded-lg bg-[var(--gp-surface-3)] p-[3px]">
            {COLUNAS.map((c) => (
              <button key={c.status} type="button" aria-pressed={card.status === c.status} disabled={atualizar.isPending && card.status !== c.status}
                onClick={() => mudarStatus(c.status)}
                className={cn('h-8 flex-1 whitespace-nowrap rounded-md border-0 text-[13px] font-semibold text-[var(--gp-text-1)] disabled:opacity-60', FOCO,
                  card.status === c.status ? 'bg-[var(--gp-surface-1)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]' : 'bg-transparent')}>
                {c.rotulo}
              </button>
            ))}
          </div>
          {erroStatus ? <p role="alert" className="m-0 text-xs text-[var(--gp-danger)]">{erroStatus}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {zap ? (
            <a href={zap.href} target="_blank" rel="noopener noreferrer" onClick={abriuZap} className={cn(BOTAO_SECUNDARIO, 'h-[34px]')}>
              <Icon name="whatsapp" size={15} />WhatsApp
            </a>
          ) : (
            <button type="button" disabled aria-describedby={`${id}-semzap`} className={cn(BOTAO_SECUNDARIO, 'h-[34px]')}>
              <Icon name="whatsapp" size={15} />WhatsApp
            </button>
          )}
          <Link to={linkMural} className={cn(BOTAO_SECUNDARIO, 'h-[34px]')}>
            <Icon name="campaign" size={15} />Mensagem no mural
          </Link>
          {!zap ? <span id={`${id}-semzap`} className="w-full text-xs text-[var(--gp-text-3)]">{semZap}</span> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-[var(--gp-border-subtle)] pt-3.5">
          <h3 id={`${id}-hist`} className="m-0 text-[13.5px] font-semibold text-[var(--gp-text-1)]">Histórico</h3>
          <ul aria-labelledby={`${id}-hist`} className="m-0 flex list-none flex-col gap-2 p-0">
            {historico.map((h, i) => (
              <li key={`${h.em}-${i}`} className="flex gap-2.5 text-[13px]">
                <span className="min-w-0 flex-1 break-words text-[var(--gp-text-2)]">{h.texto}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--gp-text-3)]">{h.data}</span>
              </li>
            ))}
          </ul>
          <form onSubmit={enviarComentario} className="mt-1 flex gap-2">
            <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Escrever comentário" aria-label="Escrever comentário"
              maxLength={1000} aria-invalid={!!erroComentario} aria-describedby={erroComentario ? `${id}-erro-coment` : undefined}
              className={cn(INPUT, 'flex-1', erroComentario ? 'border-[var(--gp-danger)]' : 'border-[var(--gp-border-input)]')} />
            <button type="submit" disabled={!comentario.trim() || comentarM.isPending} className={cn(BOTAO_PRIMARIO, 'h-9 px-3 text-[13px]')}>
              Comentar
            </button>
          </form>
          {erroComentario ? <p id={`${id}-erro-coment`} role="alert" className="m-0 text-xs text-[var(--gp-danger)]">{erroComentario}</p> : null}
        </div>
        <Toast toast={toast} />
      </SheetContent>
    </Sheet>
  );
}
