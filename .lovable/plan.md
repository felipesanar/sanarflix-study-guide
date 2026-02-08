
# Plano: Redesign Premium do UpcomingExamBanner

## Problema Identificado

O banner de prova atual tem falhas críticas de UI/UX:
- **Apenas o botão "Acelerar" é clicável** - o card não abre nenhum modal ou detalhe
- **Visual confuso** - falta clareza sobre o que é, título truncado sem contexto
- **Sem hierarquia visual** - usuário não entende rapidamente o que está vendo
- **Sem interatividade completa** - não pode editar, ver detalhes ou remover a prova

## Solução Proposta

Criar um banner **premium e claramente interativo** que:
1. Seja **todo clicável** para abrir um sheet/modal de detalhes
2. Tenha **clareza visual imediata** com título, contexto e hierarquia
3. Mostre **ações claras** com feedback visual
4. Transmita **urgência proporcional ao status** (crítico, atenção, ok)

## Design Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│  [Título claro] Próxima Prova          [badge: 5 dias] [editar]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   📚 Políticas Públicas e Sistemas de Saúde                     │
│      Prova: AP2 • 13 de fev                                     │
│                                                                  │
│   ████████░░░░░░░░░░░░ 45%                                      │
│                                                                  │
│   ⚡ 4 aulas por dia para atingir a meta                        │
│                                                                  │
│   [════════════ Estudar agora ════════════>]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Melhorias de UI

### 1. Header com Contexto Claro
- **Título fixo**: "Próxima Prova" para o usuário saber imediatamente o que é
- **Badge de contagem regressiva**: destaque visual com dias restantes
- **Botão de editar/gerenciar**: ícone de 3 pontos ou lápis para abrir opções

### 2. Conteúdo Principal
- **Nome da matéria completo** (sem truncate, com wrap se necessário)
- **Nome da prova + data formatada** claramente abaixo
- **Barra de progresso maior** (h-2 ou h-2.5) com cores por status
- **Mensagem de insight** contextual (ex: "4 aulas/dia para atingir a meta")

### 3. CTA Claro e Destacado
- **Botão primário full-width** com gradiente sutil
- **Texto dinâmico**: "Estudar agora", "Acelerar", "Revisar"
- **Ícone de seta** indicando ação

### 4. Estados Visuais por Status
```typescript
const statusStyles = {
  critical: {
    border: 'border-destructive/40',
    bg: 'bg-gradient-to-br from-destructive/15 via-destructive/5 to-transparent',
    badge: 'bg-destructive text-destructive-foreground',
    cta: 'bg-destructive hover:bg-destructive/90',
    icon: AlertTriangle,
    pulse: true // animação de urgência
  },
  warning: {
    border: 'border-amber-500/40',
    bg: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    badge: 'bg-amber-500 text-white',
    cta: 'bg-amber-500 hover:bg-amber-600',
    icon: Clock,
    pulse: false
  },
  on_track: {
    border: 'border-emerald-500/40',
    bg: 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent',
    badge: 'bg-emerald-500 text-white',
    cta: 'variant-outline',
    icon: CheckCircle,
    pulse: false
  },
  excellent: {
    border: 'border-primary/40',
    bg: 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
    badge: 'bg-primary text-primary-foreground',
    cta: 'variant-outline',
    icon: Trophy,
    pulse: false
  }
}
```

### 5. Interatividade Completa

**Card clicável** com handler dedicado:
```typescript
const handleCardClick = () => {
  // Abre bottom sheet no mobile / dialog no desktop com:
  // - Detalhes da prova
  // - Estatísticas de progresso
  // - Ações: Estudar, Editar data, Remover prova
};
```

**Bottom Sheet de Detalhes (novo componente)**:
- Informações completas da prova
- Gráfico de progresso por tema
- Lista de próximas aulas recomendadas
- Botões: "Ir para matéria", "Editar prova", "Remover"

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/home/UpcomingExamBanner.tsx` | Reescrever completamente com novo design |
| `src/components/home/ExamDetailSheet.tsx` | **Criar** - Sheet/Dialog para detalhes da prova |
| `src/components/home/MeuDiaCard.tsx` | Ajustar props se necessário |
| `src/pages/Home.tsx` | Passar handlers adicionais para edição/remoção |

## Novo UpcomingExamBanner - Estrutura

```tsx
<motion.div
  onClick={handleCardClick}
  className={cn(
    "relative rounded-xl border-2 p-4 cursor-pointer transition-all",
    "hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]",
    statusStyles.border, statusStyles.bg
  )}
>
  {/* Pulse animation for critical */}
  {statusStyles.pulse && <PulseRing />}

  {/* Header Row */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <StatusIcon className="h-4 w-4" />
      <span className="text-xs font-medium text-muted-foreground">Próxima Prova</span>
    </div>
    <div className="flex items-center gap-2">
      <Badge className={statusStyles.badge}>
        {daysRemaining === 0 ? 'Hoje!' : `${daysRemaining} dias`}
      </Badge>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEdit}>
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  </div>

  {/* Main Content */}
  <div className="space-y-2">
    <h4 className="font-semibold text-sm text-foreground">
      {exam.materia}
    </h4>
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <Calendar className="h-3 w-3" />
      {exam.exam_name} • {formatDate(exam.exam_date)}
    </p>
  </div>

  {/* Progress */}
  <div className="mt-3 space-y-1.5">
    <Progress value={percentage} className="h-2" />
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{completed}/{total} aulas</span>
      <span className={cn("font-semibold", statusStyles.text)}>{percentage}%</span>
    </div>
  </div>

  {/* Insight Message */}
  {lessons_per_day > 0 && (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      <Zap className="h-3 w-3" />
      <span>{Math.ceil(lessons_per_day)} aulas/dia para atingir a meta</span>
    </div>
  )}

  {/* CTA Button */}
  <Button
    onClick={(e) => { e.stopPropagation(); handleStudy(); }}
    className={cn("w-full mt-4 gap-2", statusStyles.cta)}
  >
    {cta_label}
    <ArrowRight className="h-4 w-4" />
  </Button>
</motion.div>
```

## Estado Vazio (Sem Prova)

Design convidativo para adicionar prova:
```text
┌──────────────────────────────────────────────┐
│  📅  Acompanhe suas provas                   │
│                                              │
│      Cadastre sua próxima prova para         │
│      organizar seus estudos                  │
│                                              │
│      [───── + Adicionar prova ─────]         │
│                                              │
└──────────────────────────────────────────────┘
```

## Critérios de Sucesso

1. **Card inteiro clicável** - abre sheet de detalhes
2. **Clareza visual imediata** - usuário entende em 2 segundos o que é
3. **Hierarquia de informação** - título > matéria > data > progresso > ação
4. **Feedback visual** - hover/press states premium
5. **Ações acessíveis** - estudar, editar, remover sem ambiguidade
6. **Responsivo** - funciona bem em 375px até 1440px
7. **Urgência proporcional** - visual crítico para provas próximas

## Próximos Passos

1. Reescrever `UpcomingExamBanner.tsx` com novo design
2. Criar `ExamDetailSheet.tsx` para modal de detalhes
3. Atualizar `Home.tsx` com handlers de edição/remoção
4. Testar em mobile e desktop
