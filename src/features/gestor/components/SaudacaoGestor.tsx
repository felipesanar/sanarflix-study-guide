import * as React from 'react';
import { GestorSkeleton } from '@/features/gestor/components/GestorSkeleton';
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

  return (
    <header data-testid="saudacao">
      {/* Título de tela da referência: 26px/700, tracking -0.01em, 32px de
          linha. `text-2xl`/`tracking-tight` do Tailwind davam 24px/600 com um
          tracking 2,5× mais apertado — a saudação ficava do mesmo peso visual
          dos títulos de card logo abaixo. */}
      <h1
        className="text-foreground"
        style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '32px' }}
      >
        {`${saudacaoPorHora(new Date())}, ${primeiroNome(contexto.usuario.nome)}`}
      </h1>
      {/* Subtítulo da referência: a FRASE de orientação, não a ficha do
          contrato. O Início existe para ORIENTAR (spec §2.1) — dizer o que a
          tela tem e para onde ela leva é o trabalho desta linha. Nome da IES,
          vigência e nº de simulados continuam ditos onde são dado, e não
          moldura: o cartão da sidebar e o rodapé de proveniência do
          cronograma. */}
      <p className="mt-1 text-sm text-muted-foreground">
        {`Acompanhe a visão institucional da ${nomeIes}: o cronograma de simulados, os avisos da Sanar e os caminhos para analisar o desempenho das suas turmas.`}
      </p>
    </header>
  );
}
