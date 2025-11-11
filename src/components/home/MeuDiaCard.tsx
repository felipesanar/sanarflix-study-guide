import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BookOpen, Zap, ClipboardList, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface StudyItem {
  id: string;
  title: string;
  type: 'guia' | 'intensivo' | 'simulado';
  progress?: string;
  link: string;
}

interface MeuDiaCardProps {
  items: StudyItem[];
}

const typeConfig = {
  guia: {
    icon: BookOpen,
    color: 'from-uscs-blue to-blue-600',
    bgColor: 'bg-uscs-blue/10',
    textColor: 'text-uscs-blue',
  },
  intensivo: {
    icon: Zap,
    color: 'from-purple-600 to-purple-800',
    bgColor: 'bg-purple-600/10',
    textColor: 'text-purple-600',
  },
  simulado: {
    icon: ClipboardList,
    color: 'from-uscs-orange to-orange-600',
    bgColor: 'bg-uscs-orange/10',
    textColor: 'text-uscs-orange',
  },
};

export const MeuDiaCard = ({ items }: MeuDiaCardProps) => {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Meu Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground space-y-4">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <div>
              <p className="mb-2">Você não tem atividades agendadas para hoje.</p>
              <p className="text-sm">👉 Configure seu plano de estudos para começar!</p>
            </div>
            <div className="flex gap-2 justify-center pt-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/guia-estudos')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
              >
                Guia de Estudos
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/cronograma-enamed')}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium"
              >
                Cronograma
              </motion.button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Meu Dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {items.map((item, index) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;

            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => navigate(item.link)}
                className={`flex items-center gap-3 p-4 rounded-xl ${config.bgColor} hover:shadow-md transition-all flex-1 min-w-[200px]`}
              >
                <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color}`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <div className={`font-semibold ${config.textColor}`}>{item.title}</div>
                  {item.progress && (
                    <div className="text-xs text-muted-foreground">{item.progress}</div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
