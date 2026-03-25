import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Send, Loader2, ShieldAlert, Sparkles,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import type { InstitutionalViewModel, DesempenhoV2Tab } from '@/types/desempenhoV2';

interface AiChatDrawerProps {
  open: boolean;
  onClose: () => void;
  data: InstitutionalViewModel | null;
  activeTab: DesempenhoV2Tab;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const TAB_CONTEXT: Record<DesempenhoV2Tab, string> = {
  'visao-institucional': 'Visão Institucional — KPIs, evolução e metas',
  'diagnostico-curricular': 'Diagnóstico Curricular — áreas, especialidades e temas',
  'visao-alunos': 'Visão de Alunos — ranking, risco e segmentação',
  'insights-pedagogicos': 'Insights Pedagógicos — recomendações e prioridades',
  'inteligencia-decisoria': 'Inteligência Decisória — ações e impacto',
};

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  'visao-institucional': [
    'Qual o conceito atual da IES e como ele se compara com o último simulado?',
    'Quantos alunos estão abaixo da proficiência e quais as principais áreas de risco?',
    'Resuma a evolução da IES nos últimos simulados.',
  ],
  'diagnostico-curricular': [
    'Quais são os 3 temas com pior desempenho?',
    'Existe alguma área com performance acima da meta?',
    'Qual especialidade merece intervenção imediata?',
  ],
  'visao-alunos': [
    'Quantos alunos estão em risco crítico e quem são?',
    'Quais alunos estão mais próximos de atingir proficiência?',
    'Existe padrão entre semestre e desempenho?',
  ],
  default: [
    'Resuma a situação geral da IES.',
    'Quais são as 3 ações mais urgentes?',
    'Como está a distribuição dos alunos por nível de risco?',
  ],
};

function generateMockResponse(question: string, data: InstitutionalViewModel | null, _tab: DesempenhoV2Tab): string {
  if (!data) return 'Não há dados carregados. Selecione um simulado para que eu possa analisar.';

  const q = question.toLowerCase();
  const { headerSummary, curricular } = data;

  if (q.includes('conceito') || q.includes('situação') || q.includes('resuma')) {
    const conceito = headerSummary.percentProficientes >= 80 ? '5' :
      headerSummary.percentProficientes >= 60 ? '4' :
      headerSummary.percentProficientes >= 40 ? '3' :
      headerSummary.percentProficientes >= 20 ? '2' : '1';
    return `**Situação atual da IES:**\n\n` +
      `- **Total de alunos:** ${headerSummary.totalAlunos}\n` +
      `- **Proficientes:** ${headerSummary.percentProficientes}%\n` +
      `- **Conceito estimado:** ${conceito}\n` +
      `- **Alunos faltando para meta:** ${headerSummary.alunosFaltamMeta}\n` +
      (headerSummary.sancao ? `\n⚠️ **Alerta de sanção:** ${headerSummary.sancao}` : '') +
      `\n\n_Baseado nos dados do último simulado carregado._`;
  }

  if (q.includes('risco') || q.includes('crítico')) {
    const criticos = data.allStudents.filter(s => s.percentual < 45).length;
    const atencao = data.allStudents.filter(s => s.percentual >= 45 && s.percentual < 55).length;
    return `**Distribuição de risco:**\n\n` +
      `- 🔴 Crítico (< 45%): **${criticos}** alunos\n` +
      `- 🟡 Atenção (45-55%): **${atencao}** alunos\n` +
      `- 🔵 Oportunidade (55-60%): **${data.allStudents.filter(s => s.percentual >= 55 && s.percentual < 60).length}** alunos\n` +
      `- 🟢 Proficientes (≥60%): **${data.allStudents.filter(s => s.percentual >= 60).length}** alunos\n\n` +
      `_Os alunos em "Oportunidade" são os com maior potencial de impacto com intervenções pontuais._`;
  }

  if (q.includes('tema') || q.includes('pior') || q.includes('fraco')) {
    const allTemas: { name: string; area: string; pct: number }[] = [];
    curricular.areas.forEach(a => a.specialties.forEach(sp => sp.temas.forEach(t => {
      allTemas.push({ name: t.name, area: a.name, pct: t.percentual });
    })));
    const worst = allTemas.sort((a, b) => a.pct - b.pct).slice(0, 3);
    return `**3 temas com pior desempenho:**\n\n` +
      worst.map((t, i) => `${i + 1}. **${t.name}** (${t.area}) — ${t.pct}%`).join('\n') +
      `\n\n_Estes temas são candidatos prioritários para intervenção pedagógica._`;
  }

  if (q.includes('ação') || q.includes('urgente') || q.includes('intervenção')) {
    return `**3 ações mais urgentes:**\n\n` +
      `1. **Reforço em temas críticos** — Focar nos temas com <50% de acurácia com sessões intensivas.\n` +
      `2. **Tutoria para alunos próximos** — Os ${data.alunosAbaixo.filter(s => s.percentual >= 55 && s.percentual < 60).length} alunos entre 55-60% podem virar proficientes com pouco esforço.\n` +
      `3. **Monitoramento semanal** — Implementar acompanhamento dos ${data.alunosAbaixo.filter(s => s.percentual < 45).length} alunos em risco crítico.\n\n` +
      `_Estas recomendações são baseadas nos dados do simulado atual._`;
  }

  return `Com base nos dados carregados, a IES tem **${headerSummary.totalAlunos} alunos** com **${headerSummary.percentProficientes}%** de proficiência. ` +
    `${headerSummary.alunosFaltamMeta} alunos precisam melhorar para atingir a meta.` +
    `\n\nPosso detalhar por **área**, **tema** ou **aluno específico**. Tente uma das perguntas sugeridas!` +
    `\n\n_Resposta gerada com base nos dados do último simulado._`;
}

export const AiChatDrawer: React.FC<AiChatDrawerProps> = ({
  open, onClose, data, activeTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = SUGGESTED_QUESTIONS[activeTab] ?? SUGGESTED_QUESTIONS.default;

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

    const response = generateMockResponse(text, data, activeTab);
    const aiMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  }, [data, activeTab]);

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
          </SheetTitle>
        </SheetHeader>

        {/* Context badge */}
        <div className="px-6 pb-3">
          <Badge variant="outline" className="text-xs gap-1">
            <BarChart3 className="h-3 w-3" />
            Contexto: {TAB_CONTEXT[activeTab]}
          </Badge>
        </div>

        {/* Guardrails */}
        <div className="px-6 pb-2">
          <Card className="bg-muted/30 border-muted">
            <CardContent className="py-2 px-3 flex items-start gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Respostas baseadas nos dados do simulado carregado. O assistente não calcula TRI,
                não inventa regras do ENAMED e não substitui análise pedagógica qualificada.
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
