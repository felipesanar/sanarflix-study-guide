import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { 
  BookOpen, Zap, BarChart3, Calendar, ArrowRight, RefreshCw, AlertCircle, 
  CalendarCheck, FileText, GraduationCap, Trophy, Home as HomeIcon, 
  ClipboardCheck, TrendingUp, UserCog, Clock
} from 'lucide-react';
import { MeuDiaItem } from '@/hooks/useHomeData';
import { Skeleton } from '@/components/ui/skeleton';

interface MeuDiaCardProps {
  items: MeuDiaItem[];
  hasStudyGuide: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const iconMap: Record<string, any> = { BookOpen, Zap, BarChart3 };
const routeIconMap: Record<string, any> = {
  '/home': HomeIcon,
  '/guia-estudos': BookOpen,
  '/dashboard': BarChart3,
  '/sanarclass': GraduationCap,
  '/simulados': ClipboardCheck,
  '/intensivao-enamed': Zap,
  '/intensivo-uscs': BookOpen,
  '/cronograma-enamed': FileText,
  '/analytics': TrendingUp,
  '/gestao-usuarios': UserCog,
};

const resolveIcon = (path?: string, icon?: string) => {
  if (path) {
    for (const key of Object.keys(routeIconMap)) {
      if (path === key || path.startsWith(key)) return routeIconMap[key];
    }
  }
  if (icon && iconMap[icon]) return iconMap[icon];
  return BookOpen;
};

// Empty state component
const EmptyState = ({ hasStudyGuide }: { hasStudyGuide: boolean }) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="mb-6 relative">
        <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center">
          <Calendar className="w-10 h-10 text-muted-foreground/40" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-foreground mb-2">
        Nenhuma atividade para hoje
      </h3>
      
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        {hasStudyGuide 
          ? "Você não tem matérias agendadas para hoje."
          : "Configure seu plano de estudos para começar."
        }
      </p>

      <Button
        onClick={() => navigate(hasStudyGuide ? '/cronograma-enamed' : '/guia-estudos')}
        variant="outline"
        className="gap-2 rounded-xl"
      >
        {hasStudyGuide ? (
          <>
            <Calendar className="w-4 h-4" />
            Configurar Calendário
          </>
        ) : (
          <>
            <BookOpen className="w-4 h-4" />
            Configurar Guia de Estudos
          </>
        )}
      </Button>
    </div>
  );
};

// Loading skeleton
const LoadingSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="w-20 h-8 rounded-lg" />
        </div>
      ))}
    </div>
  );
};

// Error state
const ErrorState = ({ onRetry }: { onRetry?: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-destructive" />
      </div>
      
      <h3 className="text-base font-semibold text-foreground mb-2">
        Erro ao carregar dados
      </h3>
      
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        Não foi possível carregar suas atividades.
      </p>

      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2 rounded-xl">
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
};

export const MeuDiaCard: React.FC<MeuDiaCardProps> = ({ 
  items, 
  hasStudyGuide,
  loading = false,
  error = null,
  onRetry
}) => {
  const navigate = useNavigate();

  const handleItemClick = (item: MeuDiaItem) => {
    if (item.icon === 'Trophy' || /simulado/i.test(item.title) || (item.path && item.path.includes('simulado'))) {
      navigate('/simulados');
      return;
    }
    
    if (item.source === 'cronograma_enamed') {
      navigate('/home');
      return;
    }
    
    if (item.aulaNome && item.path.includes('guia-estudos')) {
      navigate(item.path);
      return;
    }
    
    navigate(item.path);
  };

  const handleLessonClick = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const isSimulado = (item: MeuDiaItem) => 
    item.icon === 'Trophy' || /simulado/i.test(item.title);

  return (
    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow duration-300 h-full">
      <CardHeader className="pb-2 pt-6 px-6">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            Meu Dia
          </CardTitle>
          {!loading && !error && items.length > 0 && (
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium bg-muted/60">
              {items.length} Sugestões
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="px-6 pb-6 pt-4">
        {loading && <LoadingSkeleton />}
        
        {!loading && error && <ErrorState onRetry={onRetry} />}
        
        {!loading && !error && items.length === 0 && (
          <EmptyState hasStudyGuide={hasStudyGuide} />
        )}
        
        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {items.map((item, index) => {
              const Icon = resolveIcon(item.path, item.icon);
              const simulado = isSimulado(item);
              
              return (
                <motion.div
                  key={`${item.id}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  onClick={() => handleItemClick(item)}
                  className="group cursor-pointer"
                >
                  <div className={`
                    relative p-4 rounded-xl border transition-all duration-200
                    ${simulado 
                      ? 'bg-primary/5 border-primary/20 hover:border-primary/40 hover:bg-primary/10' 
                      : 'bg-card border-border/50 hover:border-border hover:bg-muted/30'
                    }
                  `}>
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`
                        flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
                        ${simulado 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted text-muted-foreground'
                        }
                      `}>
                        <Icon className="w-5 h-5" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className={`font-semibold text-sm truncate ${simulado ? 'text-primary' : 'text-foreground'}`}>
                            {item.aulaNome || item.title}
                          </h4>
                        </div>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.source === 'cronograma_enamed' && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-2 py-0 h-5 font-medium border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            >
                              CRONOGRAMA ENAMED
                            </Badge>
                          )}
                          {item.source === 'calendar' && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-2 py-0 h-5 font-medium border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            >
                              <CalendarCheck className="w-2.5 h-2.5 mr-1" />
                              MEU CALENDÁRIO
                            </Badge>
                          )}
                          {item.subtitle && !item.source && (
                            <span className="truncate">{item.subtitle}</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            45 min
                          </span>
                        </div>
                      </div>
                      
                      {/* Action */}
                      {item.lessonLink ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-shrink-0 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleLessonClick(e, item.lessonLink!)}
                        >
                          Assistir aula
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
