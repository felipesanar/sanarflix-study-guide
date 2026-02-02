import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb,
  Monitor,
  MousePointerClick,
  Flag,
  Keyboard,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Timer,
  LayoutGrid,
  Trash2,
  RotateCcw,
  Maximize,
  Volume2,
  Sparkles,
} from 'lucide-react';

interface HowToUseSimuladoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const steps = [
  {
    id: 1,
    icon: Lightbulb,
    title: 'Bem-vindo ao Modo Prova',
    subtitle: 'Prepare-se para a melhor experiência',
    content: [
      {
        icon: Maximize,
        title: 'Tela Cheia Automática',
        description: 'O simulado entra em modo tela cheia para máxima concentração',
      },
      {
        icon: Volume2,
        title: 'Ambiente Silencioso',
        description: 'Escolha um local tranquilo, sem distrações',
      },
      {
        icon: Timer,
        title: 'Cronômetro Ativo',
        description: 'O tempo começa a contar assim que você iniciar',
      },
    ],
  },
  {
    id: 2,
    icon: Monitor,
    title: 'Navegação e Interface',
    subtitle: 'Conheça os elementos da tela',
    content: [
      {
        icon: Timer,
        title: 'Cronômetro no Topo',
        description: 'Tempo restante em destaque. Fica vermelho nos últimos 5 minutos',
      },
      {
        icon: LayoutGrid,
        title: 'Navegação Lateral',
        description: 'Mini-grade com todas as questões. Cores indicam o status',
      },
      {
        icon: ArrowRight,
        title: 'Botões de Navegação',
        description: 'Use "Anterior" e "Próxima" para navegar entre questões',
      },
    ],
    colorLegend: [
      { color: 'bg-emerald-500', label: 'Respondida' },
      { color: 'bg-blue-500', label: 'Marcada para Revisão' },
      { color: 'bg-muted', label: 'Não Respondida' },
    ],
  },
  {
    id: 3,
    icon: MousePointerClick,
    title: 'Respondendo Questões',
    subtitle: 'Como selecionar e eliminar alternativas',
    content: [
      {
        icon: MousePointerClick,
        title: 'Clique para Selecionar',
        description: 'Clique em uma alternativa para selecioná-la',
      },
      {
        icon: Trash2,
        title: 'Eliminar Alternativas',
        description: 'Clique no ícone de lixeira para eliminar opções',
      },
      {
        icon: RotateCcw,
        title: 'Restaurar Eliminadas',
        description: 'Clique novamente no ícone para restaurar',
      },
    ],
  },
  {
    id: 4,
    icon: Flag,
    title: 'Marcação para Revisão',
    subtitle: 'Marque questões para revisar depois',
    content: [
      {
        icon: Flag,
        title: 'Botão "Revisar"',
        description: 'Marque questões que você quer revisar antes de finalizar',
      },
      {
        icon: LayoutGrid,
        title: 'Identificação Visual',
        description: 'Questões marcadas ficam azuis na navegação lateral',
      },
    ],
  },
  {
    id: 5,
    icon: CheckCircle2,
    title: 'Finalização',
    subtitle: 'Como encerrar sua prova',
    content: [
      {
        icon: CheckCircle2,
        title: 'Botão Finalizar',
        description: 'Clique em "Finalizar" quando terminar todas as questões',
      },
      {
        icon: LayoutGrid,
        title: 'Resumo da Prova',
        description: 'Veja quantas questões respondeu e marcou para revisão',
      },
      {
        icon: Sparkles,
        title: 'Confirmação',
        description: 'Após confirmar, suas respostas serão enviadas automaticamente',
      },
    ],
    tip: 'Revise as questões marcadas antes de finalizar!',
  },
];

export const HowToUseSimuladoModal = ({ open, onOpenChange }: HowToUseSimuladoModalProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const StepIcon = step.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden p-0 gap-0">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <StepIcon className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white">
                  {step.title}
                </DialogTitle>
                <p className="text-primary-foreground/80 text-sm mt-0.5">
                  {step.subtitle}
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {steps.map((s, index) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-white'
                    : index < currentStep
                    ? 'w-2 bg-white/60'
                    : 'w-2 bg-white/30'
                }`}
                aria-label={`Ir para passo ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Regular content cards */}
              {step.content && (
                <div className="grid gap-3">
                  {step.content.map((item, index) => {
                    const ItemIcon = item.icon;
                    return (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted/80 transition-colors"
                      >
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <ItemIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{item.title}</h4>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Color legend for navigation step */}
              {step.colorLegend && (
                <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-sm font-medium text-foreground mb-3">
                    Código de cores na navegação:
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {step.colorLegend.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-md ${item.color}`} />
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}


              {/* Tip box */}
              {step.tip && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
                >
                  <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                    {step.tip}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </Button>

          <span className="text-sm text-muted-foreground">
            {currentStep + 1} de {steps.length}
          </span>

          {currentStep === steps.length - 1 ? (
            <Button onClick={handleClose} className="gap-2 bg-primary hover:bg-primary/90">
              <CheckCircle2 className="h-4 w-4" />
              Entendi!
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-2">
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowToUseSimuladoModal;
