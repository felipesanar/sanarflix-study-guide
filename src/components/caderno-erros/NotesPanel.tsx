import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useNotes } from '@/hooks/useNotes';

export const NotesPanel: React.FC = () => {
  const { notes, loading, create, update, remove } = useNotes();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const dirtyRef = useRef(false);
  const latestRef = useRef<{ id: string | null; title: string; body: string }>({ id: null, title: '', body: '' });

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // carrega a nota selecionada no estado local
  useEffect(() => {
    if (selected) { setTitle(selected.title); setBody(selected.body_md); }
    else { setTitle(''); setBody(''); }
    dirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => { latestRef.current = { id: selectedId, title, body }; }, [selectedId, title, body]);

  const flush = useCallback(() => {
    const { id, title: t, body: b } = latestRef.current;
    if (id && dirtyRef.current) {
      update(id, { title: t, body_md: b });
      dirtyRef.current = false;
    }
  }, [update]);

  // salva pendências ao desmontar (evita race de unmount do enamed)
  useEffect(() => () => flush(), [flush]);

  const selectNote = (id: string) => { flush(); setSelectedId(id); };
  const handleNew = async () => { flush(); const n = await create(); if (n) setSelectedId(n.id); };
  const handleDelete = (id: string) => {
    dirtyRef.current = false;
    remove(id);
    if (selectedId === id) setSelectedId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      {/* Lista */}
      <div className="space-y-2">
        <Button onClick={handleNew} className="w-full gap-2"><Plus className="h-4 w-4" /> Nova anotação</Button>
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-4 text-center">Nenhuma anotação ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => selectNote(n.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all',
                  selectedId === n.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-accent/50',
                )}
              >
                <p className="text-sm font-medium truncate">{n.title || 'Sem título'}</p>
                <p className="text-xs text-muted-foreground truncate">{n.body_md || 'Vazia'}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <Card>
        <CardContent className="p-4 sm:p-5">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); dirtyRef.current = true; }}
                  onBlur={flush}
                  placeholder="Título"
                  className="font-medium"
                />
                <Button variant="ghost" size="sm" onClick={() => handleDelete(selected.id)} aria-label="Excluir anotação" className="shrink-0 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); dirtyRef.current = true; }}
                onBlur={flush}
                placeholder="Escreva sua anotação…"
                className="min-h-[240px] resize-none leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">Salvo automaticamente.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <FileText className="h-7 w-7 mb-3 opacity-40" />
              <p className="text-sm">Selecione ou crie uma anotação.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
