import * as React from 'react';
import { cn } from '@/lib/utils';
import type { AlunoFlix } from '../../api/fonte';
import type { NovaIntervencaoManual, TipoIntervencao } from '../../api/types';
import { BOTAO_PRIMARIO, FOCO, INPUT } from './estilos';
import { SeletorDestinatarios, type Destinatarios } from './SeletorDestinatarios';
import { TIPOS_CRIADOR, nomeDe, rotuloTipo, type Modalidade } from './util';

interface Props {
  modalidade: Modalidade;
  alunos: readonly AlunoFlix[];
  estadoAlunos: 'ok' | 'loading' | 'error';
  inicial?: { destinatarios?: Destinatarios; descricao?: string | null };
  enviando: boolean;
  /** Mensagem pronta (`mensagemErro`) do último envio que falhou. */
  erroEnvio: string | null;
  onCriar: (n: NovaIntervencaoManual) => void;
  onCancelar: () => void;
}

const ERRO_DESTINO = 'Diga para quem é a intervenção.';

/** Card-formulário no topo de "A fazer" (protótipo: tipo, para quem obrigatório, descrição opcional). */
export function CriadorIntervencao({ modalidade, alunos, estadoAlunos, inicial, enviando, erroEnvio, onCriar, onCancelar }: Props) {
  const id = React.useId();
  const [tipo, setTipo] = React.useState<TipoIntervencao>('individual');
  const [destino, setDestino] = React.useState<Destinatarios>(inicial?.destinatarios ?? { turmaToda: false, emails: [] });
  const [descricao, setDescricao] = React.useState(inicial?.descricao ?? '');
  const [erro, setErro] = React.useState(false);
  const paraQuemRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { paraQuemRef.current?.focus(); }, []);

  const nomes = React.useMemo(() => new Map(alunos.map((a) => [a.email.toLowerCase(), a.nome])), [alunos]);
  const vazio = !destino.turmaToda && destino.emails.length === 0;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (vazio) {
      setErro(true);
      paraQuemRef.current?.focus();
      return;
    }
    const quem = destino.turmaToda ? 'Turma toda' : destino.emails.length === 1 ? nomeDe(destino.emails[0], nomes) : `${destino.emails.length} alunos`;
    onCriar({
      tipo,
      titulo: descricao.trim() || `${rotuloTipo(tipo, modalidade)} com ${quem}`,
      nota: null,
      destino: destino.turmaToda ? { turmaToda: true } : { alunoIds: destino.emails },
    });
  };

  return (
    <form aria-label="Nova intervenção" onSubmit={enviar} noValidate
      className="flex flex-col gap-2 rounded-[10px] border border-[var(--gp-brand-border)] bg-[var(--gp-surface-1)] p-2.5">
      <div role="group" aria-label="Tipo" className="flex gap-0.5 rounded-lg bg-[var(--gp-surface-3)] p-[3px]">
        {TIPOS_CRIADOR.map((t) => (
          <button key={t.id} type="button" aria-pressed={tipo === t.id} onClick={() => setTipo(t.id)}
            className={cn('h-7 flex-1 whitespace-nowrap rounded-md border-0 text-[12.5px] font-semibold', FOCO,
              tipo === t.id ? 'bg-[var(--gp-text-1)] text-[var(--gp-surface-1)]' : 'bg-transparent text-[var(--gp-text-2)]')}>
            {t.rotulo}
          </button>
        ))}
      </div>
      <SeletorDestinatarios id={`${id}-para`} inputRef={paraQuemRef} alunos={alunos} estadoAlunos={estadoAlunos} valor={destino}
        onChange={(v) => { setDestino(v); setErro(false); }} invalido={erro} idErro={`${id}-erro`} />
      {erro ? <span id={`${id}-erro`} className="text-xs text-[var(--gp-danger)]">{ERRO_DESTINO}</span> : null}
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que você vai fazer? (opcional)"
        aria-label="Descrição" maxLength={200} className={cn(INPUT, 'border-[var(--gp-border-input)]')} />
      {erroEnvio ? <p role="alert" className="m-0 text-xs text-[var(--gp-danger)]">{erroEnvio}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancelar}
          className={`h-8 whitespace-nowrap rounded-lg border-0 bg-transparent px-2.5 text-[13px] font-semibold text-[var(--gp-brand)] ${FOCO}`}>
          Cancelar
        </button>
        <button type="submit" disabled={enviando} className={cn(BOTAO_PRIMARIO, 'h-8 px-3 text-[13px]')}>
          Adicionar
        </button>
      </div>
    </form>
  );
}
