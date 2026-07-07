import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Loader2, ShieldAlert, Sparkles,
  BarChart3, FlaskConical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import type { DesempenhoV2Filters, InstitutionalViewModel, DesempenhoV2Tab } from '@/types/desempenhoV2';
import { deriveInsights } from '@/experiences/gestor/copiloto';

/**
 * Rotas reais das 7 telas do console de Gestão (`/gestor/*`). Mantidas aqui
 * (em vez de importar `GestorNav`) para o drawer não depender de módulo de
 * navegação — só precisa do path para escolher contexto/sugestões.
 */
type GestorRoute =
  | '/gestor/panorama'
  | '/gestor/diagnostico-curricular'
  | '/gestor/alunos-risco'
  | '/gestor/intervencao-impacto'
  | '/gestor/simulados-questoes'
  | '/gestor/comparar-ies'
  | '/gestor/relatorios';

/**
 * Mapeia o `DesempenhoV2Tab` legado (usado pelo call-site antigo em
 * `src/pages/DesempenhoInstitucionalV2.tsx`) para a rota real mais próxima —
 * só para preservar compatibilidade enquanto aquela página legada existir.
 * Novo código deve usar `route`, não `activeTab`.
 */
const ROUTE_BY_LEGACY_TAB: Record<DesempenhoV2Tab, GestorRoute> = {
  'visao-institucional': '/gestor/panorama',
  'diagnostico-curricular': '/gestor/diagnostico-curricular',
  'visao-alunos': '/gestor/alunos-risco',
  'insights-pedagogicos': '/gestor/simulados-questoes',
  'inteligencia-decisoria': '/gestor/intervencao-impacto',
};

interface AiChatDrawerProps {
  open: boolean;
  onClose: () => void;
  data: InstitutionalViewModel | null;
  /** Path atual do console (ex.: `/gestor/panorama`). Preferido — cobre as 7 telas reais. */
  route?: string;
  /**
   * @deprecated Use `route`. Mantido só para o call-site legado
   * (`DesempenhoInstitucionalV2.tsx`) não quebrar — mapeado internamente
   * para a rota mais próxima via {@link ROUTE_BY_LEGACY_TAB}.
   */
  activeTab?: DesempenhoV2Tab;
  /** Filtros ativos do recorte — citados no rodapé das respostas mock. */
  filters?: DesempenhoV2Filters;
  /** Nome do simulado selecionado — citado no rodapé das respostas mock. */
  simuladoNome?: string;
  /** Pergunta a enviar automaticamente ao abrir (fluxo "Perguntar" da CopilotoStrip). */
  initialQuestion?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const ROUTE_CONTEXT: Record<GestorRoute, string> = {
  '/gestor/panorama': 'Panorama — conceito MEC, evolução e adesão',
  '/gestor/diagnostico-curricular': 'Diagnóstico Curricular — áreas, especialidades e temas',
  '/gestor/alunos-risco': 'Alunos & Risco — ranking, risco e segmentação',
  '/gestor/intervencao-impacto': 'Intervenção & Impacto — fila priorizada e simulador',
  '/gestor/simulados-questoes': 'Simulados & Questões — caderno de erros da turma',
  '/gestor/comparar-ies': 'Comparar IES — desempenho entre instituições do grupo',
  '/gestor/relatorios': 'Relatórios — exportação do recorte atual',
};

const SUGGESTED_QUESTIONS: Record<GestorRoute, string[]> = {
  '/gestor/panorama': [
    'Qual o conceito atual da IES e como ele se compara com o último simulado?',
    'Quantos alunos estão abaixo da proficiência e quais as principais áreas de risco?',
    'Resuma a evolução da IES nos últimos simulados.',
  ],
  '/gestor/diagnostico-curricular': [
    'Quais são os 3 temas com pior desempenho?',
    'Existe alguma área com performance acima da meta?',
    'Qual especialidade merece intervenção imediata?',
  ],
  '/gestor/alunos-risco': [
    'Quantos alunos estão em risco crítico e quem são?',
    'Quais alunos estão mais próximos de atingir proficiência?',
    'Existe padrão entre semestre e desempenho?',
  ],
  '/gestor/intervencao-impacto': [
    'Qual tema tem o maior impacto se eu intervir agora?',
    'Quanto o conceito melhora se eu resolver os 3 temas do topo da fila?',
    'Quais temas são ganho rápido (50-60% de acerto)?',
  ],
  '/gestor/simulados-questoes': [
    'Quais questões tiveram o pior índice de acerto?',
    'Existe alguma questão candidata a anulação?',
    'Quais temas merecem revisão com o colegiado?',
  ],
  '/gestor/comparar-ies': [
    'Qual IES do grupo teve a pior variação neste simulado?',
    'Como a IES atual se compara à média do grupo?',
    'Existe alguma IES em risco de sanção no grupo?',
  ],
  '/gestor/relatorios': [
    'O que muda no relatório se eu trocar o recorte de base?',
    'Quais dados entram no relatório exportado?',
    'Como compartilhar este relatório com o colegiado?',
  ],
};

const DEFAULT_ROUTE: GestorRoute = '/gestor/panorama';

function resolveRoute(route?: string, activeTab?: DesempenhoV2Tab): GestorRoute {
  if (route) {
    const match = (Object.keys(ROUTE_CONTEXT) as GestorRoute[]).find((r) => route.startsWith(r));
    if (match) return match;
  }
  if (activeTab) return ROUTE_BY_LEGACY_TAB[activeTab] ?? DEFAULT_ROUTE;
  return DEFAULT_ROUTE;
}

function sourceFooter(filters?: DesempenhoV2Filters, simuladoNome?: string): string {
  if (!simuladoNome && !filters) return '';
  const base = filters?.baseMode === 'semestres'
    ? (filters.semestres.length ? `Semestres ${filters.semestres.join(', ')}` : 'Semestres (todos)')
    : filters?.baseMode === 'general'
      ? 'IES inteira'
      : '6º ano';
  const simulado = simuladoNome ?? 'simulado não selecionado';
  return `\n\n_Fonte: ${simulado} · ${base}._`;
}

function generateMockResponse(
  question: string,
  data: InstitutionalViewModel | null,
  filters?: DesempenhoV2Filters,
  simuladoNome?: string,
): string {
  if (!data) return 'Não há dados carregados. Selecione um simulado para que eu possa analisar.';

  const q = question.toLowerCase();
  const { headerSummary, curricular } = data;
  const footer = sourceFooter(filters, simuladoNome);

  if (q.includes('conceito') || q.includes('situação') || q.includes('resuma')) {
    return `**Situação atual da IES:**\n\n` +
      `- **Total de alunos:** ${headerSummary.totalAlunos}\n` +
      `- **Proficientes:** ${headerSummary.percentProficientes}%\n` +
      `- **Conceito estimado:** ${headerSummary.conceitoScoped ?? '—'}\n` +
      `- **Alunos faltando para meta:** ${headerSummary.alunosFaltamMeta}\n` +
      (headerSummary.sancao ? `\n⚠️ **Alerta de sanção:** ${headerSummary.sancao}` : '') +
      footer;
  }

  if (q.includes('risco') || q.includes('crítico') || q.includes('critico')) {
    const criticos = data.allStudents.filter(s => s.percentual < 50).length;
    const proximo = data.allStudents.filter(s => s.percentual >= 50 && s.percentual < 60).length;
    const proficientes = data.allStudents.filter(s => s.percentual >= 60).length;
    return `**Distribuição de risco:**\n\n` +
      `- 🔴 Crítico (< 50%): **${criticos}** alunos\n` +
      `- 🟡 Próximo (50-60%): **${proximo}** alunos\n` +
      `- 🟢 Proficientes (≥ 60%): **${proficientes}** alunos\n\n` +
      `_Os alunos "Próximo" são os com maior potencial de impacto com intervenções pontuais._` +
      footer;
  }

  if (q.includes('tema') || q.includes('pior') || q.includes('fraco') || q.includes('question') || q.includes('quest')) {
    const allTemas: { name: string; area: string; pct: number }[] = [];
    curricular.areas.forEach(a => a.specialties.forEach(sp => sp.temas.forEach(t => {
      allTemas.push({ name: t.name, area: a.name, pct: t.percentual });
    })));
    const worst = allTemas.sort((a, b) => a.pct - b.pct).slice(0, 3);
    if (worst.length === 0) return `Não encontrei temas com dados suficientes no recorte atual.${footer}`;
    return `**3 temas com pior desempenho:**\n\n` +
      worst.map((t, i) => `${i + 1}. **${t.name}** (${t.area}) — ${t.pct}%`).join('\n') +
      `\n\n_Estes temas são candidatos prioritários para intervenção pedagógica._` +
      footer;
  }

  if (q.includes('ação') || q.includes('acao') || q.includes('urgente') || q.includes('intervenção') || q.includes('intervencao') || q.includes('impacto')) {
    return `**3 ações mais urgentes:**\n\n` +
      `1. **Reforço em temas críticos** — Focar nos temas com <50% de acurácia com sessões intensivas.\n` +
      `2. **Tutoria para alunos próximos** — Os ${data.allStudents.filter(s => s.percentual >= 50 && s.percentual < 60).length} alunos entre 50-60% podem virar proficientes com pouco esforço.\n` +
      `3. **Monitoramento semanal** — Implementar acompanhamento dos ${data.allStudents.filter(s => s.percentual < 50).length} alunos em risco crítico.\n\n` +
      `_Estas recomendações são baseadas nos dados do simulado atual._` +
      footer;
  }

  if (q.includes('ies') || q.includes('grupo') || q.includes('compar')) {
    return `A comparação entre IES do grupo usa o mesmo simulado selecionado no recorte atual. ` +
      `Abra a tela **Comparar IES** para ver o ranking completo — aqui no chat ainda não calculo a comparação entre instituições.` +
      footer;
  }

  if (q.includes('relatório') || q.includes('relatorio') || q.includes('exportar') || q.includes('exportação')) {
    return `O relatório exportado usa exatamente o recorte ativo (simulado, base e filtros aplicados). ` +
      `Use o botão **Exportar** no topo do console para gerar o arquivo com estes mesmos dados.` +
      footer;
  }

  return `Com base nos dados carregados, a IES tem **${headerSummary.totalAlunos} alunos** com **${headerSummary.percentProficientes}%** de proficiência. ` +
    `${headerSummary.alunosFaltamMeta} alunos precisam melhorar para atingir a meta.` +
    `\n\nPosso detalhar por **área**, **tema** ou **aluno específico**. Tente uma das perguntas sugeridas!` +
    footer;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  open, onClose, data, route, activeTab, filters, simuladoNome, initialQuestion,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const askedInitialRef = useRef<string | undefined>(undefined);

  const resolvedRoute = resolveRoute(route, activeTab);
  const suggestions = SUGGESTED_QUESTIONS[resolvedRoute];

  // Sugestão dinâmica: reaproveita o motor de insights do copiloto condutor
  // e usa o primeiro insight com `question` como sugestão em destaque —
  // assim o drawer nunca sugere algo desalinhado do pior indicador real.
  const dynamicSuggestion = useMemo(() => {
    if (!data) return null;
    const insights = deriveInsights(resolvedRoute, data, filters ?? {
      iesId: '', simuladoId: '', periodo: '', turmas: [], semestres: [],
      areas: [], especialidades: [], temas: [], baseMode: 'sixth-year',
    }, simuladoNome);
    return insights.find((i) => i.question)?.question ?? null;
  }, [data, resolvedRoute, filters, simuladoNome]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response delay
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));

    const response = generateMockResponse(text, data, filters, simuladoNome);
    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  }, [data, filters, simuladoNome]);

  // Fluxo "Perguntar" da CopilotoStrip: quando o drawer abre com
  // `initialQuestion` setada, envia automaticamente (uma vez por pergunta).
  useEffect(() => {
    if (open && initialQuestion && askedInitialRef.current !== initialQuestion) {
      askedInitialRef.current = initialQuestion;
      sendMessage(initialQuestion);
    }
    if (!open) {
      askedInitialRef.current = undefined;
    }
  }, [open, initialQuestion, sendMessage]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Assistente de Análise
            <Badge variant="outline" className="gap-1 text-[10px] font-medium tracking-wide border-dashed text-muted-foreground">
              <FlaskConical className="h-3 w-3" />
              Protótipo
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Context badge */}
        <div className="px-6 pb-3">
          <Badge variant="outline" className="text-xs gap-1">
            <BarChart3 className="h-3 w-3" />
            Contexto: {ROUTE_CONTEXT[resolvedRoute]}
          </Badge>
        </div>

        {/* Guardrails */}
        <div className="px-6 pb-2">
          <Card className="bg-muted/30 border-muted">
            <CardContent className="py-2 px-3 flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Protótipo com respostas simuladas a partir dos dados do recorte carregado — ainda não é
                um modelo de IA real. Não calcula TRI, não inventa regras do ENAMED e não substitui
                análise pedagógica qualificada.
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Faça uma pergunta sobre os dados da IES ou use uma sugestão:
              </p>
              <div className="space-y-1.5">
                {dynamicSuggestion && (
                  <button
                    onClick={() => sendMessage(dynamicSuggestion)}
                    className="w-full text-left p-2.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-sm text-foreground flex items-start gap-2"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{dynamicSuggestion}</span>
                  </button>
                )}
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full text-left p-2.5 rounded-lg border hover:bg-accent/50 transition-colors text-sm text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-1 [&_li]:mb-0.5">
                      {msg.content.split('\n').map((line, i) => {
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={i} className="font-semibold">{line.replace(/\*\*/g, '')}</p>;
                        }
                        if (line.startsWith('- ')) {
                          return <p key={i} className="pl-2">{line.slice(2).split('**').map((part, j) =>
                            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                          )}</p>;
                        }
                        if (line.startsWith('_') && line.endsWith('_')) {
                          return <p key={i} className="text-xs text-muted-foreground italic">{line.replace(/_/g, '')}</p>;
                        }
                        if (line.match(/^\d+\./)) {
                          return <p key={i} className="pl-2">{line.split('**').map((part, j) =>
                            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                          )}</p>;
                        }
                        return line ? <p key={i}>{line.split('**').map((part, j) =>
                          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
                        )}</p> : <br key={i} />;
                      })}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Analisando dados...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre os dados..."
              className="flex-1 h-9 text-sm"
              disabled={isTyping}
            />
            <Button type="submit" size="sm" className="h-9 w-9 p-0" disabled={!input.trim() || isTyping}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
