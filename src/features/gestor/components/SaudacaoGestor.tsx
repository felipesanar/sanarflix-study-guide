import * as React from 'react';
import { motion } from 'framer-motion';

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
  const ehDia = agora.getHours() >= 6 && agora.getHours() < 18;


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

        {/* Título de tela ampliado, com o astro do momento em selo luminoso. */}
        <h1
          className="mt-2.5 flex items-center gap-3.5 text-foreground"
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '46px' }}
        >
          <span aria-hidden className="relative inline-flex shrink-0 items-center justify-center">
            {/* Halo suave que respira — dá profundidade sem pesar o fundo. */}
            <motion.span
              className="absolute rounded-full"
              style={{
                width: 58,
                height: 58,
                background:
                  'radial-gradient(circle, color-mix(in srgb, var(--gp-brand-on-dark) 26%, transparent) 0%, transparent 70%)',
              }}
              animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.94, 1.06, 0.94] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Selo de vidro com borda fina de marca. */}
            <span
              className="relative inline-flex items-center justify-center rounded-full"
              style={{
                width: 44,
                height: 44,
                background:
                  'linear-gradient(145deg, color-mix(in srgb, var(--gp-brand-on-dark) 14%, transparent), transparent)',
                border: '1px solid color-mix(in srgb, var(--gp-brand-on-dark) 24%, transparent)',
                boxShadow: 'inset 0 1px 0 color-mix(in srgb, white 18%, transparent)',
              }}
            >
              <motion.span
                className="inline-flex"
                style={{ color: 'var(--gp-brand-on-dark)' }}
                animate={
                  ehDia
                    ? { rotate: [0, 10, 0, -10, 0], scale: [1, 1.07, 1, 1.07, 1] }
                    : { y: [0, -2.5, 0], rotate: [-7, 5, -7] }
                }
                transition={{ duration: ehDia ? 9 : 7, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Icon name={ehDia ? 'light-mode' : 'dark-mode'} size={24} />
              </motion.span>
            </span>
          </span>
          <span>
            {`${saudacaoPorHora(agora)}, `}
            <span style={{ color: 'var(--gp-brand-on-dark)' }}>
              {primeiroNome(contexto.usuario.nome)}
            </span>
          </span>
        </h1>



        {/* Subtítulo de ORIENTAÇÃO (spec §2.1), em uma linha curta: diz apenas
            onde a pessoa está. Nome da IES, vigência e nº de simulados
            continuam ditos onde são dado, e não moldura. */}
        <p
          className="mt-1.5 max-w-2xl text-muted-foreground"
          style={{ fontSize: 'var(--gp-font-size-apoio)' }}
        >
          {`Sua vista é a ${nomeIes}.`}
        </p>

      </div>
    </header>
  );
}
