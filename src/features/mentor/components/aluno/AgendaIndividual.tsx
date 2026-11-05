/**
 * Liberar agendamento individual (docs/02 § Drawer · Aluno; capturas b2c/04, 05, 06).
 * Desligado por padrão; ligar abre a mensagem obrigatória ("Falta 1 passo"). Sem `agendaUrl` do mentor
 * o switch fica desabilitado com a mensagem de docs/07 (`mentor_sem_agenda`).
 */
import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { MENSAGENS_ERRO } from '../../api/erros';
import { formatDiaMesSp } from './formatos';

export interface AgendaIndividualProps {
  /** ISO de quando foi liberada; null = desligada. */
  liberadaDesde: string | null;
  /** O mentor tem link do Google Agenda cadastrado. */
  temAgenda: boolean;
  enviando: boolean;
  desligando: boolean;
  /** Erro da fonte, já traduzido por `mensagemErro`. */
  erro: string | null;
  onLiberar: (mensagem: string) => Promise<boolean>;
  onDesligar: () => void;
  onLimparErro: () => void;
}

export function AgendaIndividual({ liberadaDesde, temAgenda, enviando, desligando, erro, onLiberar, onDesligar, onLimparErro }: AgendaIndividualProps) {
  const [passo, setPasso] = React.useState(false);
  const [mensagem, setMensagem] = React.useState('');
  const [semMensagem, setSemMensagem] = React.useState(false);
  const idCampo = React.useId();
  const idErro = React.useId();
  const idTitulo = React.useId();
  const liberada = liberadaDesde !== null;
  const ligado = liberada || passo;
  const bloqueado = !liberada && !temAgenda;
  const abrirPasso = passo && !liberada;

  const alternar = () => {
    onLimparErro();
    if (liberada) { onDesligar(); return; }
    setPasso((p) => !p);
    setSemMensagem(false);
  };
  const enviar = async () => {
    if (!mensagem.trim()) { setSemMensagem(true); return; }
    const ok = await onLiberar(mensagem.trim());
    if (ok) { setPasso(false); setMensagem(''); }
  };

  const subtitulo = liberada
    ? `Liberado desde ${formatDiaMesSp(liberadaDesde)}. Desligar remove o botão "Agendar com o mentor" do aluno.`
    : bloqueado
      ? MENSAGENS_ERRO.mentor_sem_agenda
      : 'Para liberar, mande uma mensagem individual. Ela aparece na aba "Pra você" do aluno.';
  const erroCampo = semMensagem ? 'Sem mensagem, a agenda não é liberada.' : null;

  return (
    <section
      aria-labelledby={idTitulo}
      className="flex flex-col gap-2.5 rounded-[12px] border px-4 py-[14px]"
      style={{ borderColor: abrirPasso ? '#941F1F' : 'var(--gp-border-strong)' }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={ligado}
          aria-label="Liberar agendamento individual"
          aria-describedby={`${idTitulo}-sub`}
          disabled={bloqueado || desligando}
          onClick={alternar}
          className="relative mt-0.5 shrink-0 rounded-full border-0 transition-colors duration-[140ms] before:absolute before:-inset-2 before:content-[''] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none max-[640px]:before:-inset-3"
          style={{ width: 36, height: 20, background: ligado ? '#149142' : '#C3C6C6' }}
        >
          <span
            aria-hidden="true"
            className="absolute rounded-full bg-white transition-[left] duration-[140ms] motion-reduce:transition-none"
            style={{ top: 'calc(50% - 8px)', left: ligado ? 18 : 2, width: 16, height: 16 }}
          />
        </button>
        <div className="flex flex-1 flex-col gap-0.5">
          <span id={idTitulo} className="text-[13.5px] font-[650]">Liberar agendamento individual</span>
          <span id={`${idTitulo}-sub`} className="text-[12.5px]" style={{ color: 'var(--gp-text-2)' }}>{subtitulo}</span>
        </div>
        {abrirPasso && (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11.5px] font-bold" style={{ color: 'var(--gp-warning-on)' }}>
            <Icon name="padlock" size={12} />Falta 1 passo
          </span>
        )}
      </div>
      {abrirPasso && (
        <>
          <label htmlFor={idCampo} className="sr-only">Mensagem individual</label>
          <textarea
            id={idCampo}
            value={mensagem}
            onChange={(e) => { setMensagem(e.target.value); setSemMensagem(false); onLimparErro(); }}
            rows={3}
            placeholder="Mensagem individual (obrigatória)"
            aria-invalid={semMensagem || undefined}
            aria-describedby={erroCampo || erro ? idErro : undefined}
            className="resize-y rounded-[8px] border bg-white px-3 py-2.5 text-[13.5px] leading-[1.5]"
            style={{ borderColor: semMensagem ? '#C61D1D' : 'var(--gp-border-input)' }}
          />
          {(erroCampo || erro) && (
            <span id={idErro} role="alert" className="text-[12px]" style={{ color: '#C61D1D' }}>{erroCampo ?? erro}</span>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="min-w-[180px] flex-1 text-[12px]" style={{ color: 'var(--gp-text-3)' }}>Também registra "Reunião individual" em A fazer.</span>
            <button
              type="button"
              onClick={alternar}
              className="h-[34px] whitespace-nowrap rounded-[8px] border-0 bg-transparent px-2.5 text-[13px] font-semibold max-[640px]:min-h-[44px]"
              style={{ color: '#941F1F' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { void enviar(); }}
              disabled={enviando}
              aria-busy={enviando || undefined}
              className="h-[34px] whitespace-nowrap rounded-[8px] border-0 bg-[#941F1F] px-[14px] text-[13px] font-semibold text-white transition-colors duration-[140ms] hover:bg-[#7A1818] disabled:bg-[#7A1818] motion-reduce:transition-none max-[640px]:min-h-[44px]"
            >
              Enviar e liberar
            </button>
          </div>
        </>
      )}
      {!abrirPasso && erro && <span role="alert" className="text-[12px]" style={{ color: '#C61D1D' }}>{erro}</span>}
    </section>
  );
}
