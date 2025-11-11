import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Zap, BarChart3, ChevronRight, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MeuDiaItem } from '@/hooks/useHomeData';

interface MeuDiaCardProps {
  items: MeuDiaItem[];
  hasStudyGuide: boolean;
}

const iconMap = {
  BookOpen,
  Zap,
  BarChart3,
};

export const MeuDiaCard: React.FC<MeuDiaCardProps> = ({ items, hasStudyGuide }) => {
  const navigate = useNavigate();

  return (
    <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Meu Dia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Você não inseriu nenhuma matéria no seu calendário.
              </p>
              <button
                onClick={() => navigate('/guia-estudos')}
                className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1"
              >
                👉 Adicione agora no seu Guia de Estudos
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap] || BookOpen;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ x: 4 }}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-3 p-4 bg-gradient-to-r from-muted/50 to-transparent rounded-lg hover:from-muted cursor-pointer transition-all duration-300 group"
                >
                  <div className={`flex-shrink-0 w-12 h-12 bg-gradient-to-br ${item.color} rounded-lg flex items-center justify-center shadow-sm`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm mb-0.5 group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>
                    {item.subtitle && (
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
