/**
 * Faixa de contexto do Início (tribo no B2C, IES no B2B).
 * Referência: capturas/b2c/01-inicio.png · capturas/b2b/01-inicio.png ·
 * capturas/b2c/25-mobile-390-inicio.png (empilha < 600px).
 *
 * Deve substituir/estender `SaudacaoGestor` (variant), não conviver com ela.
 */
import * as React from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import type { DendeIconName } from '@/features/gestor/components/icon-names';
import type { TemaContexto } from '../tema/contexto';
import { saudacao } from '../lib/regrasMentor';

interface Acao { rotulo: string; icone: DendeIconName; onClick: () => void }

export interface FaixaContextoProps {
  tema: TemaContexto;
  primeiroNome: string;
  /** B2C: "Tribo Carcará · Nota 90+". B2B: omitido. */
  eyebrow?: string;
  /** Ícone da tribo (40px) ou selo da IES (48px). */
  marca: React.ReactNode;
  acaoSecundaria: Acao;
  acaoPrimaria: Acao;
  agora?: Date;
}

export function FaixaContexto({ tema, primeiroNome, eyebrow, marca, acaoSecundaria, acaoPrimaria, agora = new Date() }: FaixaContextoProps) {
  return (
    <header
      className="flex flex-wrap items-center"
      style={{ borderRadius: 14, background: tema.faixa, boxShadow: tema.faixaBorda, color: '#F4EDE4', padding: '14px 20px', gap: '12px 20px' }}
    >
      <div className="flex flex-1 flex-col" style={{ minWidth: 240, gap: 3 }}>
        {eyebrow ? (
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: tema.destaque }}>{eyebrow}</span>
        ) : null}
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFFFFF' }}>
          {saudacao(agora)}, {primeiroNome}
        </h1>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 4 }}>
        <button
          type="button"
          onClick={acaoSecundaria.onClick}
          className="inline-flex items-center whitespace-nowrap hover:bg-white/[0.07]"
          style={{ gap: 6, height: 36, padding: '0 12px', borderRadius: 8, background: 'transparent', color: tema.acaoSecundariaTexto, border: 0, fontWeight: 600, fontSize: 13 }}
        >
          <Icon name={acaoSecundaria.icone} size={15} />{acaoSecundaria.rotulo}
        </button>
        <button
          type="button"
          onClick={acaoPrimaria.onClick}
          className="inline-flex items-center whitespace-nowrap"
          style={{ gap: 6, height: 36, padding: '0 14px', borderRadius: 8, background: tema.acao.fundo, color: tema.acao.texto, border: 0, fontWeight: 650, fontSize: 13 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = tema.acao.fundoHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = tema.acao.fundo)}
        >
          <Icon name={acaoPrimaria.icone} size={15} />{acaoPrimaria.rotulo}
        </button>
      </div>
      <div className="flex-none">{marca}</div>
    </header>
  );
}
