import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, PlayCircle, FileText, ChevronRight, ClipboardCheck } from 'lucide-react';
import { TopAula } from '@/hooks/useHomeData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MeuSemestreCardProps {
  topAulas: TopAula[];
  conteudosRelacionados: any[];
}

export const MeuSemestreCard: React.FC<MeuSemestreCardProps> = ({ topAulas, conteudosRelacionados }) => {
  const handleWatchClass = async (aulaId: string, link: string) => {
    if (link && link !== '#') {
      // Registrar visualização no Supabase
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

      // Abrir aula
      window.open(link, '_blank');
    }
  };

  return (
    <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader className="py-5">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Meu Semestre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6">
          {/* Left: Top 3 Classes */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Top 3 Aulas Mais Acessadas
            </h3>
            {topAulas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma aula disponível</p>
            ) : (
              <div className="space-y-3">
                {topAulas.map((aula, index) => (
                  <motion.div
                    key={aula.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 bg-gradient-to-r from-blue-500/10 to-transparent rounded-lg border border-blue-500/20 hover:border-blue-500/40 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        {aula.tipo === 'questoes' ? (
                          <ClipboardCheck className="h-4 w-4 text-blue-600" />
                        ) : (
                          <PlayCircle className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold line-clamp-1 mb-0.5">
                          {aula.conteudo}
                        </h4>
                        <p className="text-xs text-muted-foreground">{aula.curso}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleWatchClass(aula.id, aula.link)}
                      className="w-full mt-2 text-xs group-hover:bg-blue-500/10"
                    >
                      {aula.tipo === 'questoes' ? (
                        <ClipboardCheck className="h-3 w-3 mr-1" />
                      ) : (
                        <PlayCircle className="h-3 w-3 mr-1" />
                      )}
                      {aula.tipo === 'questoes' ? 'Resolver agora' : 'Assistir agora'}
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
};
