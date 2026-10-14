import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { linkWhatsAppAluno } from '@/features/gestor/components/DrawerAluno';
import {
  atualizarIntervencao,
  comentarIntervencao,
  type CardIntervencao,
  type StatusIntervencao,
} from '@/services/mentor/intervencoes';
import { liberarAgenda } from '@/services/mentor/sessoes';
import { fetchTurma } from '@/services/mentor/turma';
import {
  STATUS,
  formatarDataHora,
  mapaAlunos,
  nomeAluno,
  rotuloAlvo,
  rotuloOrigem,
  rotuloTipo,
} from './intervencoes/util';

interface Props {
  card: CardIntervencao | null;
  onFechar: () => void;
}

const SEGMENTOS: Record<string, string> = {
  ativo: 'Ativo',
  esfriando: 'Esfriando',
  sumido: 'Sumido',
  sem_dado: 'Sem dado',
};

/** Drawer do card de intervenção (tela 07b). */
export const DrawerIntervencao: React.FC<Props> = ({ card, onFechar }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const turmaQ = useQuery({ queryKey: ['mentor', 'turma'], queryFn: fetchTurma, enabled: !!card });
  const alunos = React.useMemo(() => mapaAlunos(turmaQ.data), [turmaQ.data]);

  const [titulo, setTitulo] = React.useState('');
  const [comentario, setComentario] = React.useState('');
  const [formAgenda, setFormAgenda] = React.useState(false);
  const [mensagemAgenda, setMensagemAgenda] = React.useState('');

  React.useEffect(() => {
    setTitulo(card?.titulo ?? '');
  }, [card?.id, card?.titulo]);

  React.useEffect(() => {
    setComentario('');
    setFormAgenda(false);
    setMensagemAgenda('');
  }, [card?.id]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ['mentor', 'intervencoes'] });
  const falha = (e: unknown) =>
    toast({
      title: 'Não foi possível salvar',
      description: e instanceof Error ? e.message : undefined,
      variant: 'destructive',
    });

  const atualizar = useMutation({
    mutationFn: (p: { titulo?: string; status?: StatusIntervencao }) => atualizarIntervencao({ id: card!.id, ...p }),
    onSuccess: invalidar,
    onError: falha,
  });
  const comentar = useMutation({
    mutationFn: (texto: string) => comentarIntervencao(card!.id, texto),
    onSuccess: () => {
      setComentario('');
      invalidar();
    },
    onError: falha,
  });
  const liberar = useMutation({
    mutationFn: (mensagem: string) => liberarAgenda(card!.alunos, mensagem),
    onSuccess: () => {
      setFormAgenda(false);
      setMensagemAgenda('');
      toast({ title: 'Agenda liberada' });
      invalidar();
    },
    onError: falha,
  });

  const individual = card ? card.alvo !== 'turma' && card.alunos.length > 0 : false;
  const unico = card && card.alunos.length === 1 ? alunos.get(card.alunos[0]) : undefined;
  const linkZap = unico ? linkWhatsAppAluno(unico.telefone, `Olá, ${unico.nome ?? ''}! `) : null;
  const paraMural =
    card && card.alvo !== 'turma' && card.alunos.length === 1
      ? `/mentor/mural?para=${encodeURIComponent(card.alunos[0])}`
      : '/mentor/mural';

  const tituloMudou = !!card && titulo.trim() !== '' && titulo.trim() !== card.titulo;

  return (
    <Sheet open={card !== null} onOpenChange={(o) => !o && onFechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {card ? (
          <div className="space-y-5">
            <SheetHeader>
              <SheetTitle>Intervenção</SheetTitle>
              <SheetDescription>
                {rotuloTipo(card.tipo)} · {rotuloOrigem(card)} · criada em {formatarDataHora(card.criado_em)}
              </SheetDescription>
            </SheetHeader>

            <section className="space-y-1">
              <label htmlFor="intervencao-titulo" className="text-xs font-medium">
                Título
              </label>
              <div className="flex gap-2">
                <input
                  id="intervencao-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="h-9 flex-1 rounded border bg-background px-2 text-sm"
                />
                {tituloMudou ? (
                  <Button
                    size="sm"
                    disabled={atualizar.isPending}
                    onClick={() => atualizar.mutate({ titulo: titulo.trim() })}
                  >
                    Salvar título
                  </Button>
                ) : null}
              </div>
              {card.nota ? <p className="pt-1 text-xs text-muted-foreground">{card.nota}</p> : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-medium">{card.alvo === 'turma' ? 'Alvo' : 'Aluno'}</h3>
              {card.alvo === 'turma' ? (
                <p className="text-sm">{rotuloAlvo(card, alunos)}</p>
              ) : (
                <ul className="space-y-2">
                  {card.alunos.map((email) => {
                    const a = alunos.get(email);
                    return (
                      <li key={email} className="flex items-start justify-between gap-2 rounded border p-2 text-sm">
                        <div>
                          <p className="font-medium">{nomeAluno(email, alunos)}</p>
                          <p className="text-xs text-muted-foreground">
                            {email}
                            {a?.semestre ? ` · ${a.semestre}º semestre` : ''}
                            {a ? ` · ${SEGMENTOS[a.segmento] ?? a.segmento}` : ''}
                            {a?.dias_sem_atividade != null ? ` · há ${a.dias_sem_atividade} dias sem acesso` : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/mentor/turma?aluno=${encodeURIComponent(email)}`)}
                        >
                          Abrir aluno
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-1">
              <label htmlFor="intervencao-status" className="text-xs font-medium">
                Status
              </label>
              <select
                id="intervencao-status"
                aria-label="Status"
                value={card.status}
                disabled={atualizar.isPending}
                onChange={(e) => atualizar.mutate({ status: e.target.value as StatusIntervencao })}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {STATUS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.rotulo}
                  </option>
                ))}
              </select>
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-medium">Ações</h3>
              <div className="flex flex-wrap gap-2">
                {linkZap ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={linkZap} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => navigate(paraMural)}>
                  Mensagem no mural
                </Button>
                {card.alvo === 'turma' ? (
                  <Button size="sm" variant="outline" onClick={() => navigate('/mentor/sessoes?nova=coletiva')}>
                    Nova sessão coletiva
                  </Button>
                ) : null}
                {individual ? (
                  <Button size="sm" variant="outline" onClick={() => setFormAgenda((v) => !v)}>
                    Liberar agenda
                  </Button>
                ) : null}
              </div>
              {formAgenda ? (
                <form
                  className="space-y-2 rounded border p-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mensagemAgenda.trim()) liberar.mutate(mensagemAgenda.trim());
                  }}
                >
                  <label htmlFor="agenda-mensagem" className="text-xs font-medium">
                    Mensagem para o aluno (obrigatória)
                  </label>
                  <textarea
                    id="agenda-mensagem"
                    value={mensagemAgenda}
                    onChange={(e) => setMensagemAgenda(e.target.value)}
                    rows={3}
                    className="w-full rounded border bg-background px-2 py-1 text-sm"
                  />
                  <Button type="submit" size="sm" disabled={!mensagemAgenda.trim() || liberar.isPending}>
                    Enviar e liberar
                  </Button>
                </form>
              ) : null}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-medium">Comentários</h3>
              {card.comentarios.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {card.comentarios.map((c, i) => (
                    <li key={`${c.criado_em}-${i}`} className="rounded bg-muted p-2 text-sm">
                      <p>{c.texto}</p>
                      <p className="text-[11px] text-muted-foreground">{formatarDataHora(c.criado_em)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comentario.trim()) comentar.mutate(comentario.trim());
                }}
              >
                <textarea
                  aria-label="Novo comentário"
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={2}
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                />
                <Button type="submit" size="sm" disabled={!comentario.trim() || comentar.isPending}>
                  Comentar
                </Button>
              </form>
            </section>

            <section className="space-y-1">
              <h3 className="text-xs font-medium">Histórico</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>
                  {formatarDataHora(card.criado_em)} — criada ({rotuloOrigem(card)})
                </li>
                {card.comentarios.map((c, i) => (
                  <li key={`h-${c.criado_em}-${i}`}>{formatarDataHora(c.criado_em)} — comentário adicionado</li>
                ))}
                <li>Status atual: {STATUS.find((s) => s.valor === card.status)?.rotulo}</li>
              </ul>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default DrawerIntervencao;
