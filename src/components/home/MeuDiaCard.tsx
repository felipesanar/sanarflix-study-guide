import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { BookOpen, Zap, BarChart3, Calendar, ArrowRight, RefreshCw, AlertCircle, CalendarCheck, FileText, GraduationCap, Trophy, Home as HomeIcon, ClipboardCheck, TrendingUp, UserCog } from 'lucide-react';
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

// Estado vazio enriquecido com ilustração e onboarding
const EmptyState = ({ hasStudyGuide }: { hasStudyGuide: boolean }) => {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      {/* Ilustração SVG de calendário vazio */}
      <div className="mb-6 relative">
        <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
          <Calendar className="w-16 h-16 text-muted-foreground/40" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center">
          <span className="text-lg">📚</span>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        Nenhuma atividade para hoje
      </h3>
      
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        {hasStudyGuide 
          ? "Você não tem matérias agendadas para hoje no seu calendário."
          : "Configure seu plano de estudos para começar a estudar de forma organizada."
        }
      </p>

      {/* Mini onboarding: 3 passos */}
      {!hasStudyGuide && (
        <div className="w-full max-w-sm mb-6 space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Configure seu guia</p>
              <p className="text-xs text-muted-foreground">Escolha suas matérias e semestre</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Monte seu calendário</p>
              <p className="text-xs text-muted-foreground">Organize os horários de estudo</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Acompanhe seu progresso</p>
              <p className="text-xs text-muted-foreground">Veja suas estatísticas diárias</p>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={() => navigate(hasStudyGuide ? '/cronograma-enamed' : '/guia-estudos')}
        className="gap-2"
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

// Loading granular: skeleton individual para cada tipo de item
const LoadingSkeleton = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl border border-border/50">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      ))}
    </div>
  );
};

// Estado de erro com botão de retry
const ErrorState = ({ onRetry }: { onRetry?: () => void }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Erro ao carregar dados
      </h3>
      
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        Não foi possível carregar suas atividades. Verifique sua conexão e tente novamente.
      </p>

      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
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
    // Simulados sempre vão para /simulados
    if (item.icon === 'Trophy' || /simulado/i.test(item.title) || (item.path && item.path.includes('simulado'))) {
      navigate('/simulados');
      return;
    }
    
    // Cronograma ENAMED vai para home
    if (item.source === 'cronograma_enamed') {
      navigate('/home');
      return;
    }
    
    // Se tem aula sugerida com deep link, navegar direto
    if (item.aulaNome && item.path.includes('guia-estudos')) {
      navigate(item.path);
      return;
    }
    
    // Fallback para path padrão
    navigate(item.path);
  };

  const handleLessonClick = (e: React.MouseEvent, link: string) => {
    e.stopPropagation();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const cleanSubtitle = (s?: string) => {
    if (!s) return s;
    return s.replace(/^Aula\s*Sugerida:\s*/i, '').trim();
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Calendar className="w-5 h-5 text-primary" />
          Meu Dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Estado de loading */}
        {loading && <LoadingSkeleton />}
        
        {/* Estado de erro */}
        {!loading && error && <ErrorState onRetry={onRetry} />}
        
        {/* Estado vazio */}
        {!loading && !error && items.length === 0 && (
          <EmptyState hasStudyGuide={hasStudyGuide} />
        )}
        
        {/* Estado com dados */}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Sugestões de hoje</h4>
            {items.map((item, index) => {
              const Icon = resolveIcon(item.path, item.icon);
              return (
                <motion.div
                  key={`${item.id}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => handleItemClick(item)}
                  className="group cursor-pointer"
                >
                  <div className="p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:shadow-md transition-all bg-card">
                    <div className="flex items-center gap-3">
                      {/* Ícone com gradiente */}
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 max-[380px]:hidden`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      
                      {/* Conteúdo principal */}
                      <div className="flex-1 min-w-0">
                        {/* Se tem aula sugerida, mostrar como principal */}
                        {item.aulaNome ? (
                          <>
                            <div className="flex items-center gap-2 gap-y-1 mb-0.5 flex-wrap">
                              <p className="text-xs text-muted-foreground truncate">
                                {item.title}
                              </p>
                              {/* Badge de origem */}
                              {item.source === 'calendar' && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] px-1.5 py-0 h-5 gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 truncate max-w-[220px] sm:max-w-none"
                                >
                                  <CalendarCheck className="w-3 h-3" />
                                  Meu Calendário
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-foreground w-full whitespace-normal break-words sm:truncate">
                              {item.aulaNome}
                            </h4>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 gap-y-1 mb-0.5 flex-wrap">
                              <h4 className="font-semibold text-foreground truncate">
                                {item.title}
                              </h4>
                              {/* Badge de origem */}
                              {item.source === 'cronograma_enamed' && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] px-1.5 py-0 h-5 gap-1 border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400 cursor-pointer hover:bg-purple-500/20 truncate max-w-[240px] sm:max-w-none"
                                  onClick={(e) => { e.stopPropagation(); navigate('/home'); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); navigate('/home'); } }}
                                  role="button"
                                  tabIndex={0}
                                  aria-label="Ir para Cronograma ENAMED"
                                >
                                  <FileText className="w-3 h-3" />
                                  Cronograma ENAMED
                                </Badge>
                              )}
                            </div>
                            {item.subtitle && (
                              <p className="text-sm text-muted-foreground w-full whitespace-normal break-words sm:truncate">
                                {cleanSubtitle(item.subtitle)}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Botão de ação */}
                      {item.lessonLink ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 text-xs flex-shrink-0"
                          onClick={(e) => handleLessonClick(e, item.lessonLink!)}
                        >
                          <span>
                            Assistir<span className="hidden sm:inline"> aula</span>
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      ) : (
                        <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
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
