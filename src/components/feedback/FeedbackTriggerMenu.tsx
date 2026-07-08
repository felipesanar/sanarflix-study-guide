import React from 'react';
import { motion } from 'framer-motion';
import {
  Bug,
  Lightbulb,
  Sparkles,
  Heart,
  HelpCircle,
  MessageCircle,
  ChevronRight,
  LifeBuoy,
  BarChart3,
  MessagesSquare,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useFeedback, type FeedbackCategory, type FeedbackAudience } from './FeedbackProvider';

const ALUNO_FAQS = [
  { q: 'Não consigo entrar ou redefinir a senha', a: 'Use a opção de alterar senha na área de conta; verifique seu e-mail e pasta de spam; se o link expirar, solicite novamente.' },
  { q: 'Meu semestre está errado', a: 'Verifique seu perfil; se persistir, use o botão do WhatsApp abaixo para corrigirmos.' },
  { q: 'Estou com problemas com o simulado', a: 'Ative a tela cheia, use a navegação lateral horizontal, marque para revisão. Se travar, recarregue a página — seu progresso é mantido.' },
  { q: 'Cronograma ENAMED', a: 'Use filtros por semana/tema; os itens são atualizados periodicamente. Em caso de inconsistência, entre em contato.' },
  { q: 'Preferências de interface', a: 'Tema claro/escuro automático; no Modo Prova a sidebar/toolbar ficam ocultas para foco total.' },
];

const GESTOR_FAQS = [
  { q: 'Um dado do dashboard parece estranho', a: 'Compare com o modo debug (?debug=true na URL) para ver o RPC bruto vs. o que a tela mostra. Se a divergência persistir, abra um chamado.' },
  { q: 'Como interpretar Nota Prevista / TRI', a: 'Nota Prevista é uma projeção com base no desempenho recente; TRI considera dificuldade e discriminação das questões. Detalhes nos tooltips de cada card.' },
  { q: 'Como exportar relatórios', a: 'Use o botão "Exportar" no topo — gera PDF ou XLSX com os filtros ativos.' },
  { q: 'Preciso de um indicador que não existe', a: 'Envie como "Sugestão de indicador" — nossa equipe avalia e responde em até 1 dia útil.' },
];

const ALUNO_CATEGORIES: Array<{
  id: FeedbackCategory;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { id: 'bug', label: 'Reportar problema', hint: 'ex: "a questão 3 do simulado não carrega"', icon: Bug, tone: 'text-destructive' },
  { id: 'suggestion', label: 'Sugerir melhoria', hint: 'ex: "adicionar filtro por dificuldade"', icon: Lightbulb, tone: 'text-primary' },
  { id: 'feature_request', label: 'Pedir funcionalidade', hint: 'ex: "modo offline pro guia"', icon: Sparkles, tone: 'text-accent-foreground' },
  { id: 'praise', label: 'Mandar um elogio', hint: 'a gente adora ouvir 💚', icon: Heart, tone: 'text-rose-500' },
];

const GESTOR_CATEGORIES: Array<{
  id: FeedbackCategory;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  { id: 'bug', label: 'Bug ou erro na plataforma', hint: 'algo travou ou está inconsistente', icon: Bug, tone: 'text-destructive' },
  { id: 'suggestion', label: 'Dúvida sobre um dado', hint: 'não entendi um número ou tooltip', icon: MessagesSquare, tone: 'text-primary' },
  { id: 'feature_request', label: 'Sugestão de indicador', hint: 'um novo corte ou métrica útil', icon: BarChart3, tone: 'text-accent-foreground' },
  { id: 'praise', label: 'Elogio', hint: 'conta o que funcionou', icon: Heart, tone: 'text-rose-500' },
];

interface Props {
  audience: FeedbackAudience;
  onClose?: () => void;
}

export const FeedbackTriggerMenu: React.FC<Props> = ({ audience, onClose }) => {
  const { openFeedback } = useFeedback();
  const [query, setQuery] = React.useState('');

  const isGestor = audience === 'gestor';
  const cats = isGestor ? GESTOR_CATEGORIES : ALUNO_CATEGORIES;
  const faqs = isGestor ? GESTOR_FAQS : ALUNO_FAQS;

  const filtered = faqs.filter(
    (i) =>
      i.q.toLowerCase().includes(query.toLowerCase()) ||
      i.a.toLowerCase().includes(query.toLowerCase()),
  );

  const handleWhatsApp = () => {
    const msg = encodeURIComponent('Olá, preciso de ajuda com a plataforma Sanarflix Academy.');
    window.open(`https://wa.me/5571993120049?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const pick = (id: FeedbackCategory) => {
    onClose?.();
    openFeedback(id);
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho contextual */}
      <div className="flex items-center gap-2">
        {isGestor ? (
          <LifeBuoy className="h-4 w-4 text-primary" />
        ) : (
          <Heart className="h-4 w-4 text-primary" />
        )}
        <div>
          <div className="text-sm font-semibold text-foreground leading-tight">
            {isGestor ? 'Fale com o time Sanar' : 'Fala com a gente'}
          </div>
          <div className="text-xs text-muted-foreground">
            {isGestor
              ? 'Respondemos em até 1 dia útil'
              : 'Cada mensagem é lida — respondemos em até 3 dias úteis'}
          </div>
        </div>
      </div>

      {/* Chips de categoria — entrada direta pro drawer */}
      <div className="space-y-1.5">
        {cats.map((c) => {
          const Icon = c.icon;
          return (
            <motion.button
              key={c.id}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => pick(c.id)}
              className={cn(
                'group w-full flex items-center gap-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-all p-2.5 text-left',
              )}
            >
              <div className={cn('h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0', c.tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{c.label}</div>
                <div className="text-xs text-muted-foreground truncate">{c.hint}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </motion.button>
          );
        })}
      </div>

      {/* FAQ / autoatendimento */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {isGestor ? 'Antes de abrir chamado' : 'Central de ajuda'}
          </span>
        </div>
        <Input
          placeholder="Buscar dúvida"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 text-sm"
        />
        <Accordion type="single" collapsible className="w-full">
          {filtered.map((item, idx) => (
            <AccordionItem key={idx} value={`item-${idx}`}>
              <AccordionTrigger className="text-xs sm:text-sm text-left py-2.5">{item.q}</AccordionTrigger>
              <AccordionContent className="text-xs sm:text-sm">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
          {filtered.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-3">Nenhuma dúvida encontrada</div>
          )}
        </Accordion>
        {!isGestor && (
          <div className="flex justify-end pt-1">
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 text-xs font-medium transition-colors"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Falar no WhatsApp
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
};
