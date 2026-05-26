import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Bug, Lightbulb, Sparkles, Heart, X, Image as ImageIcon, ChevronDown, Loader2, Check } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { FeedbackCategory } from './FeedbackProvider';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCategory: FeedbackCategory | null;
}

const CATEGORIES: Array<{
  id: FeedbackCategory;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  placeholder: string;
}> = [
  {
    id: 'bug',
    label: 'Reportar problema',
    description: 'Algo travou ou está estranho',
    icon: Bug,
    accent: 'from-destructive/20 to-destructive/5 border-destructive/40 text-destructive',
    placeholder: 'Conta o que aconteceu, em que tela e o que você estava tentando fazer…',
  },
  {
    id: 'suggestion',
    label: 'Sugerir melhoria',
    description: 'Uma ideia para deixar tudo melhor',
    icon: Lightbulb,
    accent: 'from-primary/20 to-primary/5 border-primary/40 text-primary',
    placeholder: 'Qual parte da plataforma poderia ser melhor — e como você imagina?',
  },
  {
    id: 'feature_request',
    label: 'Pedir funcionalidade',
    description: 'Algo novo que faria diferença',
    icon: Sparkles,
    accent: 'from-accent/40 to-accent/5 border-accent text-accent-foreground',
    placeholder: 'Descreve a funcionalidade que você gostaria de ter — e por que ela ajudaria…',
  },
  {
    id: 'praise',
    label: 'Mandar um elogio',
    description: 'Conta o que você curtiu',
    icon: Heart,
    accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/40 text-rose-500',
    placeholder: 'O que tem funcionado bem pra você? A gente adora ouvir 💚',
  },
];

const messageSchema = z
  .string()
  .trim()
  .min(10, 'Conta um pouquinho mais (mín. 10 caracteres)')
  .max(2000, 'Texto muito longo (máx. 2000 caracteres)');

export const FeedbackSheet: React.FC<Props> = ({ open, onOpenChange, initialCategory }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'pick' | 'form' | 'success'>('pick');
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteFlash, setPasteFlash] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialCategory) {
        setCategory(initialCategory);
        setStep('form');
      } else {
        setStep('pick');
        setCategory(null);
      }
      setMessage('');
      setFile(null);
      setFilePreview(null);
      setIncludeMetadata(true);
      setShowContext(false);
      setError(null);
    }
  }, [open, initialCategory]);

  const selected = useMemo(() => CATEGORIES.find((c) => c.id === category) ?? null, [category]);

  const firstName = user?.nome?.split(' ')[0] || 'oi';
  const viewport = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '';
  const pageUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  const handlePickFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setFilePreview(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(f.type)) {
      toast.error('Use uma imagem PNG, JPG ou WEBP.');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!user?.id || !category) return;
    const parsed = messageSchema.safeParse(message);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      let screenshot_url: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop() ?? 'png';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('feedback-screenshots')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        screenshot_url = path;
      }

      const { error: insErr } = await supabase.from('user_feedback').insert({
        user_id: user.id,
        category,
        message: parsed.data,
        screenshot_url,
        include_metadata: includeMetadata,
        page_url: includeMetadata ? pageUrl : null,
        viewport: includeMetadata ? viewport : null,
        user_agent: includeMetadata ? navigator.userAgent : null,
        ies_id: includeMetadata ? user.id_ies || null : null,
        semestre: includeMetadata ? user.semestre ?? null : null,
        user_role: includeMetadata ? (user.roles?.[0] ?? null) : null,
      });
      if (insErr) throw insErr;

      setStep('success');
    } catch (e: any) {
      console.error('[feedback] submit error', e);
      toast.error('Não consegui enviar agora. Tenta de novo em alguns segundos?');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        <div className="relative px-6 pt-6 pb-4 border-b border-border/60">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Fala com a gente</div>
          <h2 className="text-2xl font-semibold tracking-tight mt-1">
            {step === 'success' ? 'Recebido 💚' : `Oi, ${firstName} — o que você quer contar?`}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {step === 'pick' && (
              <motion.div
                key="pick"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  return (
                    <motion.button
                      key={c.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setCategory(c.id);
                        setStep('form');
                      }}
                      className={cn(
                        'group relative text-left p-4 rounded-2xl border bg-gradient-to-br transition-all',
                        'hover:shadow-lg hover:border-primary/60',
                        c.accent
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-9 w-9 rounded-xl bg-background/80 flex items-center justify-center">
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      <div className="font-semibold text-foreground">{c.label}</div>
                      <div className="text-xs text-muted-foreground mt-1">{c.description}</div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {step === 'form' && selected && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <button
                  onClick={() => setStep('pick')}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  ← Trocar categoria
                </button>

                <div
                  className={cn(
                    'rounded-2xl border bg-gradient-to-br p-3 flex items-center gap-3',
                    selected.accent
                  )}
                >
                  <div className="h-9 w-9 rounded-xl bg-background/80 flex items-center justify-center">
                    <selected.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-foreground">{selected.label}</div>
                    <div className="text-xs text-muted-foreground">{selected.description}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fb-message" className="text-sm">Sua mensagem</Label>
                  <Textarea
                    id="fb-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={selected.placeholder}
                    rows={6}
                    className="resize-none rounded-xl"
                    maxLength={2000}
                  />
                  <div className="flex justify-between items-center text-xs">
                    <span className={cn('text-destructive', !error && 'invisible')}>{error || '·'}</span>
                    <span className="text-muted-foreground">{message.length}/2000</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Anexar print (opcional)</Label>
                  {filePreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img src={filePreview} alt="Preview" className="w-full max-h-48 object-cover" />
                      <button
                        onClick={() => handlePickFile(null)}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-accent/30 transition-colors cursor-pointer text-sm text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                      Clique para escolher uma imagem
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card/50">
                  <button
                    onClick={() => setShowContext((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground">O que enviamos junto</span>
                    <ChevronDown
                      className={cn('h-4 w-4 text-muted-foreground transition-transform', showContext && 'rotate-180')}
                    />
                  </button>
                  {showContext && (
                    <div className="px-3 pb-3 pt-1 space-y-2 text-xs text-muted-foreground border-t border-border">
                      <div><span className="font-medium text-foreground">Página:</span> {pageUrl}</div>
                      <div><span className="font-medium text-foreground">Tela:</span> {viewport}</div>
                      <div><span className="font-medium text-foreground">IES:</span> {user?.ies_nome || '—'}</div>
                      <div><span className="font-medium text-foreground">Semestre:</span> {user?.semestre ?? '—'}</div>
                      <div className="flex items-center justify-between pt-1.5 border-t border-border">
                        <Label htmlFor="meta-toggle" className="text-xs">Enviar esses dados</Label>
                        <Switch
                          id="meta-toggle"
                          checked={includeMetadata}
                          onCheckedChange={setIncludeMetadata}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                  className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mb-6"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                  >
                    <Check className="h-7 w-7" strokeWidth={3} />
                  </motion.div>
                  {[...Array(6)].map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
                      animate={{
                        scale: 1,
                        x: Math.cos((i / 6) * Math.PI * 2) * 60,
                        y: Math.sin((i / 6) * Math.PI * 2) * 60,
                        opacity: 0,
                      }}
                      transition={{ duration: 0.9, delay: 0.25 }}
                      className="absolute h-2 w-2 rounded-full bg-primary"
                    />
                  ))}
                </motion.div>
                <h3 className="text-xl font-semibold tracking-tight mb-1">
                  Valeu por contar, {firstName}!
                </h3>
                <p className="text-sm text-muted-foreground max-w-xs mb-6">
                  Cada feedback é lido pela nossa equipe. Você pode acompanhar o status na sua página de feedbacks.
                </p>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => onOpenChange(false)}
                  >
                    Fechar
                  </Button>
                  <Button
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/meus-feedbacks');
                    }}
                  >
                    Ver meus feedbacks
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step === 'form' && (
          <div className="px-6 py-4 border-t border-border/60 bg-background/80 backdrop-blur flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Shift + F a qualquer momento
            </span>
            <Button
              onClick={handleSubmit}
              disabled={submitting || message.trim().length < 10}
              className="rounded-xl ml-auto"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
              ) : (
                'Enviar feedback'
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
