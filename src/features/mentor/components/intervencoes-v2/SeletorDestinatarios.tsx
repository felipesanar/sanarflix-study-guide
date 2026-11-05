import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/features/gestor/components/Icon';
import type { AlunoFlix } from '../../api/fonte';
import { FOCO } from './estilos';

export interface Destinatarios { turmaToda: boolean; emails: string[] }

const MAX_OPCOES = 8;
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Props {
  id: string;
  alunos: readonly AlunoFlix[];
  /** Lista de alunos ainda carregando / com falha (o seletor continua aceitando "Turma toda"). */
  estadoAlunos: 'ok' | 'loading' | 'error';
  valor: Destinatarios;
  onChange: (v: Destinatarios) => void;
  invalido: boolean;
  idErro?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

type Opcao = { chave: string; rotulo: string; email: string | null };

/**
 * "Para quem" do protótipo ("Aluno, grupo ou Turma toda") como combobox: em produção o destino precisa
 * ser e-mails da turma ou a turma inteira, então o texto livre vira busca + escolha. Vários alunos = grupo.
 */
export function SeletorDestinatarios({ id, alunos, estadoAlunos, valor, onChange, invalido, idErro, inputRef }: Props) {
  const [texto, setTexto] = React.useState('');
  const [aberto, setAberto] = React.useState(false);
  const [ativo, setAtivo] = React.useState(0);
  const idLista = `${id}-opcoes`;

  const porEmail = React.useMemo(() => new Map(alunos.map((a) => [a.email.toLowerCase(), a])), [alunos]);
  const nome = (email: string) => porEmail.get(email.toLowerCase())?.nome || email;

  const opcoes = React.useMemo<Opcao[]>(() => {
    const q = normalizar(texto);
    const lista: Opcao[] = [];
    if (!valor.turmaToda && (!q || normalizar('Turma toda').includes(q))) lista.push({ chave: 'turma', rotulo: 'Turma toda', email: null });
    const escolhidos = new Set(valor.emails.map((e) => e.toLowerCase()));
    for (const a of alunos) {
      if (lista.length > MAX_OPCOES) break;
      if (escolhidos.has(a.email.toLowerCase())) continue;
      if (q && !normalizar(a.nome).includes(q) && !normalizar(a.email).includes(q)) continue;
      lista.push({ chave: a.email, rotulo: a.nome || a.email, email: a.email.toLowerCase() });
    }
    return lista;
  }, [alunos, texto, valor]);

  React.useEffect(() => setAtivo(0), [texto, aberto]);

  const escolher = (o: Opcao) => {
    onChange(o.email === null ? { turmaToda: true, emails: [] } : { turmaToda: false, emails: [...valor.emails, o.email] });
    setTexto('');
    setAberto(false);
  };
  const remover = (email: string | null) =>
    onChange(email === null ? { turmaToda: false, emails: [] } : { turmaToda: false, emails: valor.emails.filter((e) => e !== email) });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!aberto) setAberto(true);
      else setAtivo((i) => Math.min(i + 1, Math.max(opcoes.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (aberto && opcoes[ativo]) {
        e.preventDefault();
        escolher(opcoes[ativo]);
      }
    } else if (e.key === 'Escape') {
      if (aberto) {
        e.preventDefault();
        e.stopPropagation();
        setAberto(false);
      }
    } else if (e.key === 'Backspace' && texto === '') {
      if (valor.turmaToda) remover(null);
      else if (valor.emails.length) remover(valor.emails[valor.emails.length - 1]);
    }
  };

  const chips: { chave: string; rotulo: string; email: string | null }[] = valor.turmaToda
    ? [{ chave: 'turma', rotulo: 'Turma toda', email: null }]
    : valor.emails.map((e) => ({ chave: e, rotulo: nome(e), email: e }));
  const idAtivo = aberto && opcoes[ativo] ? `${id}-op-${ativo}` : undefined;

  return (
    <div className="relative">
      <div
        className={cn(
          'flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-[var(--gp-surface-1)] px-1.5 py-1 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--gp-brand)]',
          invalido ? 'border-[var(--gp-danger)]' : 'border-[var(--gp-border-input)]',
        )}
      >
        {chips.map((c) => (
          <span key={c.chave} className="inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--gp-surface-3)] py-0.5 pl-2.5 pr-1 text-[12.5px] font-semibold text-[var(--gp-text-1)]">
            <span className="truncate">{c.rotulo}</span>
            <button type="button" onClick={() => remover(c.email)} aria-label={`Remover ${c.rotulo}`}
              className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[var(--gp-text-2)] hover:bg-[var(--gp-border-strong)] ${FOCO}`}>
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          role="combobox"
          aria-label="Para quem"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={idAtivo}
          aria-invalid={invalido}
          aria-describedby={invalido ? idErro : undefined}
          autoComplete="off"
          value={texto}
          placeholder={chips.length ? '' : 'Aluno, grupo ou Turma toda'}
          onChange={(e) => { setTexto(e.target.value); setAberto(true); }}
          onClick={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={onKeyDown}
          className="h-7 min-w-[120px] flex-1 border-0 bg-transparent px-1 text-[13.5px] text-[var(--gp-text-1)] outline-none placeholder:text-[var(--gp-text-3)]"
        />
      </div>
      {aberto ? (
        <ul id={idLista} role="listbox" aria-label="Alunos da turma"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-[var(--gp-border-strong)] bg-[var(--gp-surface-1)] py-1 shadow-[0_24px_48px_-20px_rgba(0,0,0,0.35)]">
          {opcoes.map((o, i) => (
            <li key={o.chave} id={`${id}-op-${i}`} role="option" aria-selected={i === ativo}
              onMouseDown={(e) => { e.preventDefault(); escolher(o); }}
              onMouseEnter={() => setAtivo(i)}
              className={cn('cursor-pointer px-3 py-2 text-[13.5px]', i === ativo && 'bg-[var(--gp-brand-surface-soft)]', o.email === null && 'font-semibold')}>
              {o.rotulo}
            </li>
          ))}
          {estadoAlunos === 'loading' ? <li role="presentation" className="px-3 py-2 text-[12.5px] text-[var(--gp-text-3)]">Carregando alunos…</li> : null}
          {estadoAlunos === 'error' ? <li role="presentation" className="px-3 py-2 text-[12.5px] text-[var(--gp-text-3)]">Não foi possível carregar os alunos.</li> : null}
          {estadoAlunos === 'ok' && opcoes.length === 0 ? <li role="presentation" className="px-3 py-2 text-[12.5px] text-[var(--gp-text-3)]">Nenhum aluno encontrado.</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
