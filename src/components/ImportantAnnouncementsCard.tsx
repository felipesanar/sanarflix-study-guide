import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const ImportantAnnouncementsCard: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
      className="h-full"
    >
      <Card className="h-full border-0 bg-gradient-to-br from-card via-card to-card/95 shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgb(0,0,0,0.02)] hover:shadow-[0_10px_40px_rgb(0,0,0,0.06),0_2px_4px_rgb(0,0,0,0.03)] transition-all duration-300 ease-in-out overflow-hidden group">
        {/* Decorative badge */}
        <div className="absolute top-4 right-4 z-10">
          <Badge 
            variant="default" 
            className="bg-primary/10 text-primary border border-primary/20 shadow-sm"
          >
            <Bell className="h-3 w-3 mr-1" />
            Novo
          </Badge>
        </div>

        <CardHeader className="pb-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center ring-1 ring-primary/10">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <CardTitle className="text-xl font-semibold leading-tight">
                Avisos Importantes
              </CardTitle>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-border via-border/50 to-transparent" />
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Fique por dentro das últimas atualizações, novos conteúdos e informações importantes sobre sua jornada de estudos.
            </p>
          </div>

          <Button 
            className="w-full group/btn bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all duration-300 ease-in-out rounded-lg"
            onClick={() => {
              // Navigate to announcements page or open modal
              console.log('Ver todos os avisos');
            }}
          >
            <span className="flex-1">Ver todos os avisos</span>
            <ChevronRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300 ease-in-out" />
          </Button>
        </CardContent>

        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
      </Card>
    </motion.div>
  );
};
