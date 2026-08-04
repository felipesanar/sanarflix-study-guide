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

  /**
   * `get_gestor_contexto()` não recebe `p_ies_id`: `contexto.contrato` é
   * sempre o da IES padrão do usuário (`contexto.iesAtual`), nunca o da IES
   * em foco no dropdown — não é reconsultado na troca (achados 1, 3 e 4 da
   * revisão de 03/08; mesma armadilha documentada em `SidebarIes.tsx:71-75`).
   * Só afirmamos o contrato quando a IES em foco é de fato a IES padrão;
   * senão omitimos a informação em vez de atribuir o contrato errado à IES
   * errada (spec §4.10 — nunca afirmar mais do que o dado permite).
   */
  const contratoConfiavel = iesFocoId === contexto.iesAtual.id ? contexto.contrato : null;

  return (
    <header data-testid="saudacao">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {`${saudacaoPorHora(new Date())}, ${primeiroNome(contexto.usuario.nome)}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {nomeIes}
        {contratoConfiavel
          ? ` · ${contratoConfiavel.nome} · ${contratoConfiavel.simuladosContratados} simulados contratados`
          : ''}
      </p>
    </header>
  );
}
