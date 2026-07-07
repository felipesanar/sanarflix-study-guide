import { DataBadge, MonoValue } from '@/experiences/admin/ui';

/**
 * Bloco "Em prova agora" — `admin_monitor_summary().em_prova_agora` é `null`
 * de propósito (requer heartbeat de sessão de prova, que não existe ainda).
 * Nunca mostrar um número aqui — só "—" + badge REQUER INSTRUMENTAÇÃO.
 */
export function EmProvaAgoraBlock() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Em prova agora</span>
        <DataBadge kind="requires_instrumentation" />
      </div>
      <MonoValue muted className="text-3xl font-semibold">—</MonoValue>
      <p className="text-xs text-muted-foreground">precisa de heartbeat de sessão de prova</p>
    </div>
  );
}
