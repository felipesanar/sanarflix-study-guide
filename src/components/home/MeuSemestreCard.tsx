import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BookOpen, PlayCircle, ClipboardCheck, ExternalLink, ChevronRight } from 'lucide-react';
import { TopAula } from '@/hooks/useHomeData';
import { supabase } from '@/integrations/supabase/client';
import { Logger } from '@/utils/logger';

interface MeuSemestreCardProps {
  topAulas: TopAula[];
  conteudosRelacionados: any[];
}

export const MeuSemestreCard: React.FC<MeuSemestreCardProps> = ({ topAulas, conteudosRelacionados }) => {
  const handleWatchClass = async (aulaId: string, link: string) => {
    if (link && link !== '#') {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('aula_views')
          .insert({
            user_id: user.id,
            conteudo_id: aulaId,
          });

        if (error) {
          Logger.error('Erro ao registrar visualização:', error);
        }
      }

      window.open(link, '_blank');
    }
  };

  const getPositionBadge = (index: number) => {
    const badges = [
      { emoji: '🥇', color: 'from-amber-400 to-orange-500' },
      { emoji: '🥈', color: 'from-slate-300 to-slate-400' },
      { emoji: '🥉', color: 'from-amber-600 to-amber-700' },
    ];
    return badges[index] || null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl card-premium h-full">
      {/* Decorative gradient */}
      <div className="absolute -top-12 -right-12 sm:-top-16 sm:-right-16 w-24 sm:w-32 h-24 sm:h-32 rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-3xl" />
      
      {/* Header */}
      <div className="relative px-4 pt-4 pb-2.5 sm:px-5 sm:pt-5 sm:pb-3 md:px-6 md:pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground">Meu Semestre</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Top 3 mais acessadas</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="relative px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6">
        {topAulas.length === 0 ? (
          <div className="text-center py-6 sm:py-8 lg:py-10">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto rounded-xl sm:rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center mb-3 sm:mb-4">
              <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/40" />
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Nenhuma aula disponível</p>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {topAulas.map((aula, index) => {
              const badge = getPositionBadge(index);
              
              return (
                <motion.div
                  key={aula.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className="p-3 sm:p-4 rounded-lg sm:rounded-xl glass hover:bg-muted/30 transition-all duration-200 group cursor-pointer"
                  onClick={() => handleWatchClass(aula.id, aula.link)}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    {/* Position and Icon */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center ${
                        index === 0 
                          ? 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30' 
                          : 'bg-muted/50'
                      }`}>
                        {aula.tipo === 'questoes' ? (
                          <ClipboardCheck className={`h-4 w-4 sm:h-5 sm:w-5 ${index === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                        ) : (
                          <PlayCircle className={`h-4 w-4 sm:h-5 sm:w-5 ${index === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`} />
                        )}
                      </div>
                      {badge && (
                        <span className="absolute -top-1 -right-1 text-xs sm:text-sm">{badge.emoji}</span>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {aula.conteudo}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">{aula.curso}</p>
                    </div>
                    
                    {/* Action */}
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5 sm:mt-1" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        
        {/* View all button */}
        {topAulas.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 sm:mt-4"
          >
            <Button 
              variant="outline" 
              className="w-full gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border-border/50 hover:border-primary/30 hover:bg-primary/5 text-xs sm:text-sm h-9 sm:h-10"
            >
              Ver grade completa
              <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
};
