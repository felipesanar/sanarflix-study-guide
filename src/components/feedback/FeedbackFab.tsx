import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquarePlus, HelpCircle, MessageCircle, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { useFeedback } from './FeedbackProvider';

const FAQS = [
  { q: 'Não consigo entrar ou redefinir a senha', a: 'Use a opção de alterar senha na área de conta; verifique seu e-mail e pasta de spam; se o link expirar, solicite novamente.' },
  { q: 'Meu semestre está errado', a: 'Verifique seu perfil; se persistir, use o botão do WhatsApp abaixo para corrigirmos.' },
  { q: 'Estou com problemas com o simulado', a: 'Ative a tela cheia, use a navegação lateral horizontal, marque para revisão, e você pode restaurar alternativas eliminadas com um clique. Se travar, recarregue a página e seu progresso será mantido.' },
  { q: 'Pedir aula personalizada no SanarClass', a: 'Converse com seu professor e peça para entrar em contato; você também pode falar conosco no WhatsApp.' },
  { q: 'Cronograma ENAMED', a: 'Use filtros por semana/tema; os itens são atualizados periodicamente. Em caso de inconsistência, entre em contato.' },
  { q: 'Preferências de interface', a: 'Tema claro/escuro automático; no Modo Prova a sidebar/toolbar ficam ocultas para foco total.' },
];

export const FeedbackFab: React.FC = () => {
  const { openFeedback } = useFeedback();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const filtered = FAQS.filter(i =>
    i.q.toLowerCase().includes(query.toLowerCase()) || i.a.toLowerCase().includes(query.toLowerCase())
  );

  const handleFeedback = () => {
    setOpen(false);
    openFeedback();
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent('Olá, preciso de ajuda com a plataforma Sanarflix Academy.');
    window.open(`https://wa.me/5571993120049?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2, scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          aria-label="Reportar problema, enviar feedback ou pedir ajuda"
          className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl bg-card border border-border hover:border-primary/40 shadow-lg transition-all"
        >
          <MessageSquarePlus className="h-5 w-5 text-primary" />
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[calc(100vw-2rem)] sm:w-96 max-h-[75vh] overflow-auto rounded-xl sm:rounded-2xl shadow-xl backdrop-blur-md p-3 sm:p-4"
      >
        <div className="space-y-3 sm:space-y-4">
          {/* Ação primária: reportar problema / feedback */}
          <button
            onClick={handleFeedback}
            className="group w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all p-3 text-left"
          >
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary text-primary-foreground shrink-0">
              <MessageSquarePlus className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">Reportar problema ou feedback</div>
              <div className="text-xs text-muted-foreground">Conte o que está travando ou sugestões <span className="opacity-60">(Shift+F)</span></div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>

          {/* Seção secundária: ajuda */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Central de ajuda</span>
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
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
