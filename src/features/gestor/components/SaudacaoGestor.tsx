import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
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

/** Primeiro contato da gestora com a home (spec §2.1) — antes de qualquer bloco de conteúdo. */
export function SaudacaoGestor() {
  const { data: contexto, isLoading } = useGestorContexto();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton data-testid="saudacao-skeleton" className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  if (!contexto) {
    return null;
  }

  return (
    <header data-testid="saudacao">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {`${saudacaoPorHora(new Date())}, ${primeiroNome(contexto.usuario.nome)}`}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {contexto.iesAtual.nome}
        {contexto.contrato
          ? ` · ${contexto.contrato.nome} · ${contexto.contrato.simuladosContratados} simulados contratados`
          : ''}
      </p>
    </header>
  );
}
