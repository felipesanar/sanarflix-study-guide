import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import {
  Bug,
  Lightbulb,
  Sparkles,
  Heart,
  X,
  Image as ImageIcon,
  ChevronDown,
  Loader2,
  BarChart3,
  MessagesSquare,
  ArrowUpRight,
} from 'lucide-react';
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
import type { FeedbackCategory, FeedbackAudience } from './FeedbackProvider';
import { FeedbackTimeline } from './FeedbackTimeline';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialCategory: FeedbackCategory | null;
  audience: FeedbackAudience;
}

type CatMeta = {
  id: FeedbackCategory;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  placeholder: string;
};

const ALUNO_CATEGORIES: CatMeta[] = [
  {
    id: 'bug',
    label: 'Problema',
    hint: 'Algo travou ou está estranho',
    icon: Bug,
    tone: 'text-destructive bg-destructive/10',
    placeholder: 'O que aconteceu, em que tela e o que você estava tentando fazer?',
  },
  {
    id: 'suggestion',
    label: 'Sugestão',
    hint: 'Uma ideia para melhorar',
    icon: Lightbulb,
    tone: 'text-primary bg-primary/10',
    placeholder: 'Qual parte poderia ser melhor — e como você imagina?',
  },
  {
    id: 'feature_request',
    label: 'Funcionalidade',
    hint: 'Algo novo que faria diferença',
    icon: Sparkles,
    tone: 'text-accent-foreground bg-accent/40',
    placeholder: 'Descreve a funcionalidade que você gostaria de ter — e por que ela ajudaria.',
  },
  {
    id: 'praise',
    label: 'Elogio',
    hint: 'Conta o que você curtiu',
    icon: Heart,
    tone: 'text-rose-500 bg-rose-500/10',
    placeholder: 'O que tem funcionado bem pra você? 💚',
  },
];

const GESTOR_CATEGORIES: CatMeta[] = [
  {
    id: 'bug',
    label: 'Bug',
    hint: 'Erro na plataforma',
    icon: Bug,
    tone: 'text-destructive bg-destructive/10',
    placeholder: 'Em qual módulo aconteceu? O que você esperava ver vs. o que apareceu?',
  },
  {
    id: 'suggestion',
    label: 'Dúvida sobre dado',
    hint: 'Um número parece estranho',
    icon: MessagesSquare,
    tone: 'text-primary bg-primary/10',
    placeholder: 'Qual dado, em qual filtro, e o que ficou confuso?',
  },
  {
    id: 'feature_request',
    label: 'Indicador',
    hint: 'Sugerir novo corte/métrica',
    icon: BarChart3,
    tone: 'text-accent-foreground bg-accent/40',
    placeholder: 'Que decisão você quer tomar com esse indicador? Como ele seria calculado?',
  },
  {
    id: 'praise',
    label: 'Elogio',
    hint: 'Conta o que funcionou',
    icon: Heart,
    tone: 'text-rose-500 bg-rose-500/10',
    placeholder: 'O que ajudou você no dia a dia?',
  },
];

const messageSchema = z
  .string()
  .trim()
  .min(10, 'Conta um pouquinho mais (mín. 10 caracteres)')
  .max(2000, 'Texto muito longo (máx. 2000 caracteres)');

export const FeedbackSheet: React.FC<Props> = ({ open, onOpenChange, initialCategory, audience }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGestor = audience === 'gestor';
  const CATEGORIES = isGestor ? GESTOR_CATEGORIES : ALUNO_CATEGORIES;

  const [category, setCategory] = useState<FeedbackCategory>(initialCategory ?? CATEGORIES[0].id);
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pasteFlash, setPasteFlash] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);

  useEffect(() => {
    if (open) {
      setCategory(initialCategory ?? CATEGORIES[0].id);
      setMessage('');
      setFile(null);
      setFilePreview(null);
      setIncludeMetadata(true);
      setShowContext(false);
      setError(null);
      setSentAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCategory]);

  const selected = useMemo(
    () => CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0],
    [category, CATEGORIES],
  );

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

  // Cola imagem com Ctrl/Cmd+V
  useEffect(() => {
    if (!open || sentAt) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            const ext = f.type.split('/')[1] || 'png';
            const named = new File([f], `print-${Date.now()}.${ext}`, { type: f.type });
            handlePickFile(named);
            setPasteFlash(true);
            window.setTimeout(() => setPasteFlash(false), 900);
            toast.success('Print colado ✨');
          }
          return;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, sentAt]);

  // Ctrl/Cmd + Enter envia
  useEffect(() => {
    if (!open || sentAt) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sentAt, message, file, includeMetadata, category]);

  const handleSubmit = async () => {
    if (!user?.id) return;
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

      setSentAt(new Date());
    } catch (e: any) {
      console.error('[feedback] submit error', e);
      toast.error('Não consegui enviar agora. Tenta de novo em alguns segundos?');
    } finally {
      setSubmitting(false);
    }
  };

  const kbd = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
  const slaLabel = isGestor ? 'até 1 dia útil' : 'até 3 dias úteis';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-border/60">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {isGestor ? 'Suporte Sanar' : 'Fala com a gente'}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight mt-1">
            {sentAt
              ? 'Recebido 💚'
              : isGestor
                ? 'Abrir chamado'
                : `Oi, ${firstName} — o que rolou?`}
          </h2>
          {!sentAt && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {isGestor
                ? 'Nossa equipe responde em até 1 dia útil.'
                : 'Cada mensagem é lida — respondemos em até 3 dias úteis.'}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <AnimatePresence mode="wait">
            {!sentAt ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-5"
              >
                {/* Categoria — toggles pequenos, tudo à vista */}
                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Categoria</Label>
                  <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {CATEGORIES.map((c) => {
                      const Icon = c.icon;
                      const active = c.id === category;
                      return (
                        <motion.button
                          key={c.id}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setCategory(c.id)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all',
                            active
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border bg-card hover:border-primary/40',
                          )}
                          aria-pressed={active}
                        >
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', c.tone)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className={cn('text-[11px] font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                            {c.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Mensagem */}
                <div className="space-y-1.5">
                  <Label htmlFor="fb-message" className="text-sm">Sua mensagem</Label>
                  <Textarea
                    id="fb-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={selected.placeholder}
                    rows={5}
                    autoFocus
                    className="resize-none rounded-xl"
                    maxLength={2000}
                  />
                  <div className="flex justify-between items-center text-xs">
                    <span className={cn('text-destructive', !error && 'invisible')}>{error || '·'}</span>
                    <span className="text-muted-foreground">{message.length}/2000</span>
                  </div>
                </div>

                {/* Print */}
                <div className="space-y-2">
                  <Label className="text-sm">Anexar print (opcional)</Label>
                  {filePreview ? (
                    <div className={cn(
                      'relative rounded-xl overflow-hidden border border-border transition-shadow',
                      pasteFlash && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    )}>
                      <img src={filePreview} alt="Preview" className="w-full max-h-48 object-cover" />
                      <button
                        onClick={() => handlePickFile(null)}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/90 backdrop-blur flex items-center justify-center hover:bg-background"
                        aria-label="Remover print"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1 h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-accent/30 transition-colors cursor-pointer text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Clique para escolher uma imagem
                      </div>
                      <span className="text-xs">
                        ou cole com{' '}
                        <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono text-foreground">
                          {kbd}V
                        </kbd>
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>

                {/* Metadata (transparência) */}
                <div className="rounded-xl border border-border bg-card/50">
                  <button
                    type="button"
                    onClick={() => setShowContext((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm"
                  >
                    <span className="text-muted-foreground">
                      O que enviamos junto ({includeMetadata ? 'incluído' : 'omitido'})
                    </span>
                    <ChevronDown
                      className={cn('h-4 w-4 text-muted-foreground transition-transform', showContext && 'rotate-180')}
                    />
                  </button>
                  {showContext && (
                    <div className="px-3 pb-3 pt-1 space-y-2 text-xs text-muted-foreground border-t border-border">
                      <div><span className="font-medium text-foreground">Página:</span> {pageUrl}</div>
                      <div><span className="font-medium text-foreground">Tela:</span> {viewport}</div>
                      <div><span className="font-medium text-foreground">IES:</span> {user?.ies_nome || '—'}</div>
                      {!isGestor && (
                        <div><span className="font-medium text-foreground">Semestre:</span> {user?.semestre ?? '—'}</div>
                      )}
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
            ) : (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/0 p-5">
                  <div className="text-sm font-medium text-foreground mb-1">
                    Valeu por contar, {firstName}!
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isGestor
                      ? 'Seu chamado entrou na fila do time Sanar. Você recebe um e-mail e um aviso aqui quando a gente responder.'
                      : 'Sua mensagem já chegou pra equipe. Você recebe um aviso aqui quando tivermos novidade — e no seu e-mail também.'}
                  </p>
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                    O que acontece agora
                  </Label>
                  <div className="mt-3">
                    <FeedbackTimeline status="received" createdAt={sentAt} slaLabel={slaLabel} />
                  </div>
                </div>

                <button
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/meus-feedbacks');
                  }}
                  className="w-full group flex items-center justify-between rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/30 transition-all p-3.5"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">
                      {isGestor ? 'Ver meus chamados' : 'Ver meus feedbacks'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Acompanhe todo o histórico e respostas
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer com submit */}
        {!sentAt && (
          <div className="px-6 py-4 border-t border-border/60 bg-background/80 backdrop-blur flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">
                {kbd}
              </kbd>
              {' + '}
              <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">
                Enter
              </kbd>
              {' envia'}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={submitting || message.trim().length < 10}
              className="rounded-xl ml-auto"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
              ) : (
                isGestor ? 'Enviar chamado' : 'Enviar feedback'
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
