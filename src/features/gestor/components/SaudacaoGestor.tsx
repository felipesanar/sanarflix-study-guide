import * as React from 'react';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
import { Icon } from '@/features/gestor/components/Icon';
import { useGestorContexto } from '@/features/gestor/api/queries';

/** Função pura para não precisar de fake timers no teste. */
export function saudacaoPorHora(agora: Date): string {
  const hora = agora.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function primeiroNome(nome: string): string {
  const [primeiro] = nome.trim().split(/\s+/);
  return primeiro || nome;
}

/** Glifo do momento do dia — a saudação muda de luz junto com o horário. */
export function glifoPorHora(agora: Date): 'light-mode' | 'schedule' | 'dark-mode' {
  const hora = agora.getHours();
  if (hora < 12) return 'light-mode';
  if (hora < 18) return 'schedule';
  return 'dark-mode';
}

/** "Sexta-feira, 09 de agosto" — sentence case, sem ano (é sempre o corrente). */
export function dataLonga(agora: Date): string {
  const bruto = agora.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  return bruto.charAt(0).toUpperCase() + bruto.slice(1);
}

export interface SaudacaoGestorProps {
  /**
   * IES em foco (achados 1, 3, 4 e 7 da revisão de 03/08). Quando omitido,
   * cai em `contexto.iesAtual` — o mesmo comportamento de sempre, para quem
   * monta este componente sem recorte de IES (ex.: uso isolado em testes).
   */
  iesId?: string | null;
}

/** Primeiro contato da gestora com a home (spec §2.1) — antes de qualquer bloco de conteúdo. */
export function SaudacaoGestor({ iesId }: SaudacaoGestorProps = {}) {
  const { data: contexto, isLoading } = useGestorContexto();

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="saudacao-skeleton">
        <GestorSkeleton altura={14} rotulo="Carregando data" className="w-40" />
        <GestorSkeleton altura={32} rotulo="Carregando saudação" className="w-64" />
        <GestorSkeleton altura={16} rotulo="Carregando contexto da instituição" className="w-80" />
      </div>
    );
  }

  if (!contexto) {
    return null;
  }

  const iesFocoId = iesId ?? contexto.iesAtual.id;
  const nomeIes =
    contexto.iesDisponiveis.find((ies) => ies.id === iesFocoId)?.nome ?? contexto.iesAtual.nome;

  const agora = new Date();

  return (
    <header data-testid="saudacao" className="relative">
      <div className="relative">

        {/* Linha do dia: dá contexto temporal ao número que vem depois e faz a
            home parecer viva a cada acesso, sem afirmar nenhuma métrica. */}
        <p
          data-testid="saudacao-data"
          className="flex items-center gap-1.5 uppercase"
          style={{
            fontSize: 'var(--gp-font-size-micro)',
            fontWeight: 'var(--gp-font-weight-medio)' as unknown as number,
            letterSpacing: 'var(--gp-font-tracking-micro)',
            color: 'var(--gp-text-3)',
          }}
        >
          <Icon name={glifoPorHora(agora)} size={13} />
          {dataLonga(agora)}
        </p>

        {/* Título de tela da referência: 26px/700, tracking -0.01em, 32px de
            linha. O nome sai em cor de marca — é a única palavra da tela que
            fala com a pessoa, e não com a instituição. */}
        <h1
          className="mt-1.5 text-foreground"
          style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '32px' }}
        >
          {`${saudacaoPorHora(agora)}, `}
          <span style={{ color: 'var(--gp-brand-on-dark)' }}>
            {primeiroNome(contexto.usuario.nome)}
          </span>
        </h1>

        {/* Subtítulo de ORIENTAÇÃO (spec §2.1): diz onde a pessoa está e o que
            a tela oferece, em ordem de uso. Nome da IES, vigência e nº de
            simulados continuam ditos onde são dado, e não moldura: o cartão da
            sidebar e o rodapé de proveniência do cronograma. */}
        <p
          className="mt-1.5 max-w-2xl text-muted-foreground"
          style={{ fontSize: 'var(--gp-font-size-apoio)' }}
        >
          {`Sua vista é a ${nomeIes}. Comece pelo cronograma de simulados, confira os avisos da Sanar e siga para a análise de desempenho das suas turmas.`}
        </p>
      </div>
    </header>
  );
}
