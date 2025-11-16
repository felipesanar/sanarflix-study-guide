import React from 'react';
import { motion } from 'framer-motion';
import { HelpCircle, MessageCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';

interface QuickActionsDockProps {
  hasStudyGuide?: boolean;
  hasCronograma?: boolean;
  position?: 'fixed' | 'inline';
}

export const QuickActionsDock: React.FC<QuickActionsDockProps> = ({ position = 'fixed' }) => {
  const [query, setQuery] = React.useState('');
  const faqs = [
    { q: 'Não consigo entrar ou redefinir a senha', a: 'Use a opção de alterar senha na área de conta; verifique seu e-mail e pasta de spam; se o link expirar, solicite novamente.' },
    { q: 'Meu semestre está errado', a: 'Verifique seu perfil; se persistir, use o botão do WhatsApp abaixo para corrigirmos.' },
    { q: 'Estou com problemas com o simulado', a: 'Ative a tela cheia, use a navegação lateral horizontal, marque para revisão, e você pode restaurar alternativas eliminadas com um clique. Se travar, recarregue a página e seu progresso será mantido.' },
    { q: 'Pedir aula personalizada no SanarClass', a: 'Converse com seu professor e peça para entrar em contato; você também pode falar conosco no WhatsApp.' },
    { q: 'Cronograma ENAMED', a: 'Use filtros por semana/tema; os itens são atualizados periodicamente. Em caso de inconsistência, entre em contato.' },
    { q: 'Preferências de interface', a: 'Tema claro/escuro automático; no Modo Prova a sidebar/toolbar ficam ocultas para foco total.' },
  ];
  const filtered = faqs.filter(i => i.q.toLowerCase().includes(query.toLowerCase()) || i.a.toLowerCase().includes(query.toLowerCase()));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={position === 'fixed' ? 'fixed bottom-6 right-6 z-40' : ''}
    >
      <div className="px-2.5 md:px-3 py-2 rounded-2xl bg-background/70 backdrop-blur-xl border border-border/50 shadow-lg">
        <Popover>
          <PopoverTrigger asChild>
            <motion.button
              whileHover={{ y: -2, scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-card border border-border hover:border-primary/40 transition-all"
              aria-label="Ajuda"
            >
              <HelpCircle className="h-5 w-5" />
            </motion.button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-[85vw] sm:w-96 rounded-2xl shadow-xl backdrop-blur-md">
            <div className="space-y-3">
              <Input placeholder="Buscar dúvida" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Accordion type="single" collapsible className="w-full">
                {filtered.map((item, idx) => (
                  <AccordionItem key={idx} value={`item-${idx}`}>
                    <AccordionTrigger>{item.q}</AccordionTrigger>
                    <AccordionContent>{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <div className="flex justify-end">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground"
                  onClick={() => {
                    const msg = encodeURIComponent('Olá, preciso de ajuda com a plataforma Sanarflix Academy.');
                    const url = `https://wa.me/5571993120049?text=${msg}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </motion.button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </motion.div>
  );
};