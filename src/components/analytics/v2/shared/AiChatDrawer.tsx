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
import {
  nivelDesempenho,
  ehProficiente,
  PROFICIENCIA_MINIMA,
  NIVEL_CRITICO_MAX,
  NIVEL_EXCELENTE_MIN,
} from '@/features/gestor/lib/regras';
import { TRACO } from '@/features/gestor/lib/formatters';

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
    // Task 64b (spec §4.4, §7.3): o conceito NÃO é recalculado aqui. Antes
    // este bloco cravava uma escada local 80/60/40/20 sobre
    // percentProficientes, incompatível com a régua canônica de
    // `features/gestor/lib/regras.ts` — o mesmo aluno podia sair classificado
    // de um jeito neste drawer e de outro no resto do produto (o AiChatDrawer
    // continua com consumidor alcançável em produção via GestorLayout, então
    // a Task 64b trocou os números pela régua única em vez de apagar o
    // arquivo). O conceito já vem pronto do backend em
    // `headerSummary.conceitoScoped` — o mesmo campo que
    // VisaoInstitucionalModule exibe — nenhum componente reimplementa essa
    // régua.
    return `**Situação atual da IES:**\n\n` +
      `- **Total de alunos:** ${headerSummary.totalAlunos}\n` +
      `- **Proficientes:** ${headerSummary.percentProficientes}%\n` +
      `- **Conceito estimado:** ${headerSummary.conceitoScoped ?? TRACO}\n` +
      `- **Alunos faltando para meta:** ${headerSummary.alunosFaltamMeta}\n` +
      (headerSummary.sancao ? `\n⚠️ **Alerta de sanção:** ${headerSummary.sancao}` : '') +
      `\n\n_Baseado nos dados do último simulado carregado._`;
  }

  if (q.includes('risco') || q.includes('crítico')) {
    // Task 64b (spec §4.4, §7.3): régua única. Antes este bloco cravava 4
    // faixas locais (45/55/60), incompatíveis com a régua canônica de
    // `features/gestor/lib/regras.ts` (crítico/mediano/excelente por % de
    // acerto; proficiente por proficiência). "Atenção" e "Oportunidade" eram
    // invenção local sem equivalente na régua canônica — por isso viram 3
    // faixas, não 4 (o texto muda de propósito; ver regras.ts para a fonte
    // única dos cortes).
    const criticos = data.allStudents.filter((s) => nivelDesempenho(s.percentual) === 'critico').length;
    const medianos = data.allStudents.filter((s) => nivelDesempenho(s.percentual) === 'mediano').length;
    const proficientes = data.allStudents.filter((s) => ehProficiente(s.percentual)).length;
    return `**Distribuição de risco:**\n\n` +
      `- 🔴 Crítico (abaixo de ${NIVEL_CRITICO_MAX}%): **${criticos}** alunos\n` +
      `- 🟡 Mediano (${NIVEL_CRITICO_MAX}% a ${NIVEL_EXCELENTE_MIN}%): **${medianos}** alunos\n` +
      `- 🟢 Proficientes (${PROFICIENCIA_MINIMA}% ou mais): **${proficientes}** alunos\n\n` +
      `_Classificação pela régua única do produto: crítico/mediano por % de acerto, proficientes por proficiência._`;
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
    // Task 64b: mesma régua única do bloco de risco acima — este bloco
    // duplicava os mesmos 45/55/60 com um recorte estreito ("55-60%") sem
    // equivalente na régua canônica; agora usa a faixa mediana inteira
    // (features/gestor/lib/regras.ts).
    const criticos = data.allStudents.filter((s) => nivelDesempenho(s.percentual) === 'critico').length;
    const medianos = data.allStudents.filter((s) => nivelDesempenho(s.percentual) === 'mediano').length;
    return `**3 ações mais urgentes:**\n\n` +
      `1. **Reforço em temas críticos** — Focar nos temas com <50% de acurácia com sessões intensivas.\n` +
      `2. **Tutoria para alunos medianos** — Os ${medianos} alunos entre ${NIVEL_CRITICO_MAX}% e ${NIVEL_EXCELENTE_MIN}% de acerto são o maior grupo de oportunidade de intervenção.\n` +
      `3. **Monitoramento semanal** — Implementar acompanhamento dos ${criticos} alunos em risco crítico.\n\n` +
      `_Estas recomendações seguem a régua única do produto (features/gestor/lib/regras.ts)._`;
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
