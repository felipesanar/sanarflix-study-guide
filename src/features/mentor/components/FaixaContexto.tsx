import type { CSSProperties, ReactNode } from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { TemaContexto } from '../tema/contexto';
import { saudacao } from '../lib/regrasMentor';

interface Acao { rotulo: string; icone: DendeIconName; onClick: () => void }
export interface FaixaContextoProps {
  tema: TemaContexto;
  primeiroNome: string;
  eyebrow?: string;
  marca: ReactNode;
  acaoSecundaria: Acao;
  acaoPrimaria: Acao;
  agora?: Date;
}

/** TODO: extensão necessária em SaudacaoGestor: variant, tema, selo e slot acoes. */
export function FaixaContexto({ tema, primeiroNome, eyebrow, marca, acaoSecundaria, acaoPrimaria, agora = new Date() }: FaixaContextoProps) {
  const estilo = {
    borderRadius: 14, background: tema.faixa, boxShadow: tema.faixaBorda, color: tema.texto,
    padding: '14px 20px', gap: '12px 20px',
    '--mentor-acao': tema.acao.fundo, '--mentor-acao-hover': tema.acao.fundoHover,
  } as CSSProperties;
  const botao = 'inline-flex min-h-11 min-[600px]:min-h-9 items-center justify-center whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gp-brand)]';
  return (
    <header className="flex flex-wrap items-center max-[599px]:flex-col max-[599px]:items-stretch" style={estilo}>
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        {eyebrow ? <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: tema.destaque }}>{eyebrow}</span> : null}
        <h1 className="m-0 break-words text-[22px] font-bold tracking-[-0.02em]" style={{ color: tema.texto }}>
          {saudacao(agora)}, {primeiroNome.trim() || '—'}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={acaoSecundaria.onClick} className={`${botao} hover:bg-white/[0.07]`} style={{ color: tema.acaoSecundariaTexto }}>
          <Icon name={acaoSecundaria.icone} size={15} />{acaoSecundaria.rotulo}
        </button>
        <button type="button" onClick={acaoPrimaria.onClick} className={`${botao} bg-[var(--mentor-acao)] hover:bg-[var(--mentor-acao-hover)]`} style={{ color: tema.acao.texto }}>
          <Icon name={acaoPrimaria.icone} size={15} />{acaoPrimaria.rotulo}
        </button>
      </div>
      {marca ? <div className="flex-none max-[599px]:self-end">{marca}</div> : null}
    </header>
  );
}
