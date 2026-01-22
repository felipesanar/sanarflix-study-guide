import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, PlayCircle, ClipboardCheck, ExternalLink } from 'lucide-react';
import { TopAula } from '@/hooks/useHomeData';
import { supabase } from '@/integrations/supabase/client';

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
          console.error('Erro ao registrar visualização:', error);
        }
      }

      window.open(link, '_blank');
    }
  };

  return (
    <Card className="h-full border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="pb-2 pt-6 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Meu Semestre
          </CardTitle>
          <Button variant="link" className="text-xs text-primary font-medium h-auto p-0">
            Ver grade
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="px-6 pb-6 pt-4">
        <p className="text-xs text-muted-foreground font-medium mb-4">
          Top 3 Aulas Mais Acessadas
        </p>
        
        {topAulas.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto bg-muted/50 rounded-xl flex items-center justify-center mb-3">
              <BookOpen className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma aula disponível</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topAulas.map((aula, index) => (
              <motion.div
                key={aula.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="p-4 rounded-xl bg-card border border-border/50 hover:border-border hover:bg-muted/30 transition-all duration-200 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                    {aula.tipo === 'questoes' ? (
                      <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <PlayCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                      {aula.conteudo}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{aula.curso}</p>
                  </div>
                </div>
                
                <div className="flex justify-end mt-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleWatchClass(aula.id, aula.link)}
                    className="text-xs gap-1.5 text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {aula.tipo === 'questoes' ? 'Resolver agora' : 'Resolver agora'}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
