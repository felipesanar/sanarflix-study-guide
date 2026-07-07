import * as React from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AdminSectionHeader } from '@/experiences/admin/ui';

export interface CommandCenterHeaderProps {
  /** Primeiro nome do admin logado (ver `useAuth().user.nome`). */
  firstName: string;
  /** Soma das 4 filas de atenção — `null` enquanto os dados não chegaram (loading/erro). */
  attentionTotal: number | null;
}

/** Atualiza a cada minuto — suficiente para um relógio de dashboard, sem custo de render perceptível. */
function useNow(refreshMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return now;
}

function greetingFor(hour: number): 'manhã' | 'tarde' | 'noite' {
  if (hour < 12) return 'manhã';
  if (hour < 18) return 'tarde';
  return 'noite';
}

/** `EEEE` do date-fns devolve "segunda-feira" — o protótipo usa só "segunda" (sábado/domingo já não têm o sufixo). */
function shortWeekday(date: Date): string {
  return format(date, 'EEEE', { locale: ptBR }).replace(/-feira$/, '');
}

function attentionSubtitle(total: number | null): string {
  if (total == null) return 'Carregando pendências…';
  if (total === 0) return 'Tudo em dia por aqui.';
  return `${total} ${total === 1 ? 'item precisa' : 'itens precisam'} da sua atenção hoje.`;
}

/**
 * Header do Command Center (contrato §A): linha mono uppercase com data/hora
 * atual + H1 de saudação dinâmica + subtítulo com a soma das filas de atenção
 * + ações de criação rápida ("Novo simulado", "Novo usuário").
 */
export const CommandCenterHeader: React.FC<CommandCenterHeaderProps> = ({ firstName, attentionTotal }) => {
  const navigate = useNavigate();
  const now = useNow();

  const dateTimeLine = `${shortWeekday(now)}, ${format(now, "d 'de' MMMM", { locale: ptBR })} · ${format(now, 'HH:mm')}`;

  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{dateTimeLine}</p>
      <AdminSectionHeader
        title={`Boa ${greetingFor(now.getHours())}, ${firstName}.`}
        subtitle={attentionSubtitle(attentionTotal)}
        actions={
          <>
            <Button size="sm" onClick={() => navigate('/admin/simulados?new=1')}>
              Novo simulado
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/usuarios?new=1')}>
              Novo usuário
            </Button>
          </>
        }
      />
    </div>
  );
};
