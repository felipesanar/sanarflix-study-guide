/** Peças compartilhadas pelos drawers B2C e B2B (anatomia de docs/02 e docs/03 § Drawer · Aluno). */
import * as React from 'react';
import { Link } from 'react-router-dom';
import { SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import { iniciais } from './formatos';

export const DURACAO_TOAST_MS = 3200;

// ─── Toast (docs/01 § Padrões: embaixo no centro, 3,2 s, role="status") ─────

export function useToastAluno() {
  const [mensagem, setMensagem] = React.useState<string | null>(null);
  const [chave, setChave] = React.useState(0);
  React.useEffect(() => {
    if (!mensagem) return;
    const t = window.setTimeout(() => setMensagem(null), DURACAO_TOAST_MS);
    return () => window.clearTimeout(t);
  }, [mensagem, chave]);
  const mostrar = React.useCallback((texto: string) => { setMensagem(texto); setChave((c) => c + 1); }, []);
  return { mensagem, mostrar };
}

/** Fica dentro do diálogo para o leitor de tela anunciar mesmo com o resto da página inerte. */
export function ToastAluno({ mensagem }: { mensagem: string | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center px-4">
      {mensagem && (
        <span
          className="inline-flex max-w-full items-center gap-2.5"
          style={{
            padding: '12px 16px', borderRadius: 10, background: '#111212', color: '#FFFFFF', fontSize: 13.5,
            boxShadow: '0 12px 32px -12px rgba(0,0,0,0.4)',
          }}
        >
          <Icon name="check" size={16} />
          {mensagem}
        </span>
      )}
    </div>
  );
}

// ─── Botões de ação do cabeçalho ─────────────────────────────────────────────

const CLASSE_ACAO =
  'inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[8px] border bg-[var(--gp-surface-1)] px-3 text-[13px] font-semibold text-[color:var(--gp-text-1)] ' +
  'border-[color:var(--gp-border-strong)] transition-colors duration-[140ms] hover:border-[color:var(--gp-border-input)] ' +
  'disabled:cursor-not-allowed disabled:text-[color:var(--gp-text-3)] disabled:hover:border-[color:var(--gp-border-strong)] max-[640px]:min-h-[44px] motion-reduce:transition-none';

type PropsBotao = { icone: DendeIconName; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>;
export function BotaoAcao({ icone, children, className, ...rest }: PropsBotao) {
  return (
    <button type="button" className={cn(CLASSE_ACAO, className)} {...rest}>
      <Icon name={icone} size={15} />
      {children}
    </button>
  );
}

export function LinkAcao({ icone, children, to }: { icone: DendeIconName; children: React.ReactNode; to: string }) {
  return (
    <Link to={to} className={CLASSE_ACAO}>
      <Icon name={icone} size={15} />
      {children}
    </Link>
  );
}

/** WhatsApp: abre o wa.me em nova aba; sem telefone, o botão fica desabilitado com o motivo. */
export function AcaoWhatsApp({ href, onAbrir }: { href: string | null; onAbrir: () => void }) {
  if (!href) {
    return <BotaoAcao icone="whatsapp" disabled title="Sem telefone cadastrado">WhatsApp</BotaoAcao>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={CLASSE_ACAO} onClick={onAbrir}>
      <Icon name="whatsapp" size={15} />
      WhatsApp
    </a>
  );
}

// ─── Cabeçalho ──────────────────────────────────────────────────────────────

export function CabecalhoAluno({ nome, linha, tags, children, acoes, erroAcao }: {
  nome: string;
  linha: React.ReactNode;
  tags?: React.ReactNode;
  children?: React.ReactNode;
  acoes: React.ReactNode;
  erroAcao?: string | null;
}) {
  return (
    <div className="flex flex-col gap-[14px] border-b px-6 pb-4 pt-5 max-[480px]:px-4" style={{ borderColor: 'var(--gp-border-subtle)' }}>
      <div className="flex items-start gap-[14px] pr-11">
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center rounded-full font-bold"
          style={{ width: 46, height: 46, background: 'var(--gp-brand-surface)', color: 'var(--gp-brand)' }}
        >
          {iniciais(nome)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <SheetTitle className="m-0 text-left text-[18px] font-bold leading-tight [overflow-wrap:anywhere]" style={{ letterSpacing: 0 }}>{nome}</SheetTitle>
          <SheetDescription asChild>
            <span className="flex flex-wrap items-center gap-1.5 text-left text-[12.5px]" style={{ color: 'var(--gp-text-2)' }}>{linha}</span>
          </SheetDescription>
          {tags && <span className="flex flex-wrap gap-1.5">{tags}</span>}
        </div>
      </div>
      {children}
      <div className="flex flex-wrap gap-2">{acoes}</div>
      {erroAcao && <p role="alert" className="m-0 text-[12px]" style={{ color: 'var(--gp-danger)' }}>{erroAcao}</p>}
    </div>
  );
}

// ─── Consumo no Flix · últimos 30 dias ──────────────────────────────────────

export function ConsumoFlix({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={id} className="m-0 text-[14px] font-[650]">Consumo no Flix</h3>
        <span className="text-[12px]" style={{ color: 'var(--gp-text-3)' }}>últimos 30 dias</span>
      </div>
      <dl className="m-0 grid grid-cols-2 overflow-hidden rounded-[10px] border min-[480px]:grid-cols-4" style={{ borderColor: 'var(--gp-border-subtle)' }}>
        {itens.map((m) => (
          <div key={m.rotulo} className="-ml-px -mt-px flex min-w-0 flex-col gap-0.5 border-l border-t px-3 py-2.5" style={{ borderColor: 'var(--gp-border-subtle)' }}>
            <dt className="truncate text-[11.5px]" style={{ color: 'var(--gp-text-3)' }}>{m.rotulo}</dt>
            <dd className="m-0 text-[17px] font-bold tabular-nums">{m.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ─── Dados de contato (B2C) ─────────────────────────────────────────────────

export function DadosAluno({ itens }: { itens: { rotulo: string; valor: string }[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-3 text-[13px] min-[480px]:grid-cols-3">
      {itens.map((i) => (
        <div key={i.rotulo} className="min-w-0">
          <dt className="text-[11.5px]" style={{ color: 'var(--gp-text-3)' }}>{i.rotulo}</dt>
          <dd className="m-0 mt-0.5 font-semibold tabular-nums [overflow-wrap:anywhere]">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Carregando / título acessível nos estados sem aluno ────────────────────

export function TituloOculto({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <>
      <SheetTitle className="sr-only">{titulo}</SheetTitle>
      <SheetDescription className="sr-only">{descricao}</SheetDescription>
    </>
  );
}

/** Skeleton na anatomia do drawer: cabeçalho, bloco de agenda/consumo e lista de notas. */
export function SkeletonDrawer() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <TituloOculto titulo="Carregando aluno" descricao="Carregando os dados do aluno" />
      <span role="status" aria-label="Carregando aluno" className="sr-only">Carregando aluno</span>
      <div aria-hidden="true" className="flex flex-col gap-[14px] border-b px-6 pb-4 pt-5" style={{ borderColor: 'var(--gp-border-subtle)' }}>
        <div className="flex items-start gap-[14px] pr-11">
          <GestorSkeleton altura={46} className="!w-[46px] shrink-0 rounded-full" rotulo="" />
          <div className="flex flex-1 flex-col gap-2"><GestorSkeleton altura={20} rotulo="" /><GestorSkeleton altura={14} rotulo="" /></div>
        </div>
        <GestorSkeleton altura={34} rotulo="" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-6 px-6 py-[18px]">
        <GestorSkeleton altura={64} rotulo="" />
        <GestorSkeleton altura={72} rotulo="" />
        <GestorSkeleton altura={160} rotulo="" />
      </div>
    </div>
  );
}

/** Corpo rolável do drawer (o cabeçalho fica fixo). */
export function CorpoDrawer({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-24 pt-[18px] max-[480px]:px-4">{children}</div>;
}
