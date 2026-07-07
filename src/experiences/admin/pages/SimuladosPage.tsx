import * as React from 'react';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminSectionHeader, AdminLoading } from '@/experiences/admin/ui';
import { cn } from '@/lib/utils';

const ProvasTab = lazy(() => import('@/components/admin/simulados/ProvasTab'));
const LiberacoesTab = lazy(() => import('@/components/admin/simulados/LiberacoesTab'));
const ImportarRespostasTab = lazy(() => import('@/components/admin/simulados/ImportarRespostasTab'));

type SimTab = 'provas' | 'liberacoes' | 'importar';

const TABS: Array<{ id: SimTab; label: string }> = [
  { id: 'provas', label: 'Provas' },
  { id: 'liberacoes', label: 'Liberações' },
  { id: 'importar', label: 'Importar respostas' },
];

/**
 * Seção Simulados (`/admin/simulados`) — container das sub-abas por estado
 * (sincronizadas em `?tab=` para deep-link a partir do Command Center e do
 * Monitoramento). Conteúdo das abas: fatias C1 (Provas) e C2 (Liberações,
 * Importar respostas).
 */
const SimuladosPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: SimTab = tabParam === 'liberacoes' || tabParam === 'importar' ? tabParam : 'provas';

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Simulados"
        subtitle="Criar e manter provas, liberar tentativas e importar respostas de turmas inteiras."
      />
      <div className="flex gap-1 border-b" role="tablist" aria-label="Sub-seções de Simulados">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setSearchParams(t.id === 'provas' ? {} : { tab: t.id }, { replace: true })}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Suspense fallback={<AdminLoading rows={6} />}>
        {tab === 'provas' && <ProvasTab />}
        {tab === 'liberacoes' && <LiberacoesTab />}
        {tab === 'importar' && <ImportarRespostasTab />}
      </Suspense>
    </div>
  );
};

export default SimuladosPage;
