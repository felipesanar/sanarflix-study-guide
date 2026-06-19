import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useAccessRules } from '@/hooks/useAccessRules';
import { useNotebookDueCount } from '@/hooks/useNotebookDueCount';
import { useAnalyticsTracker } from '@/hooks/useAnalyticsTracker';

/**
 * Surfacing do Caderno de Erros na home: mostra um banner quando há questões
 * devidas para revisão. Auto-contido — decide a própria visibilidade
 * (some quando a IES não tem o caderno ou quando não há devidas).
 */
export const CadernoHomeBanner: React.FC = () => {
  const navigate = useNavigate();
  const { accessRules } = useAccessRules();
  const { count, loading } = useNotebookDueCount();
  const { trackEvent } = useAnalyticsTracker();
  const tracked = React.useRef(false);

  React.useEffect(() => {
    if (!loading && count > 0 && accessRules.errorNotebook && !tracked.current) {
      trackEvent({ eventName: 'ce_home_due_banner_viewed', category: 'navigation', data: { due: count } });
      tracked.current = true;
    }
  }, [loading, count, accessRules.errorNotebook, trackEvent]);

  if (loading || !accessRules.errorNotebook || count === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mb-5 lg:mb-6">
      <div className="flex items-center gap-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] p-4 sm:p-5">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {count} {count === 1 ? 'questão para revisar' : 'questões para revisar'} hoje
          </p>
          <p className="text-xs text-muted-foreground">Mantenha a revisão em dia no seu Caderno de Erros.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/caderno-de-erros/revisao')} className="gap-1.5 shrink-0">
          Revisar <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
};
