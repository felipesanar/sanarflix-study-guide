

# Plano: Carrossel Netflix-Style para Card de Provas

## Objetivo

Transformar o card "Suas Provas" (modo compacto) de uma lista vertical que cresce em altura para um carrossel horizontal estilo Netflix com:
- Auto-play rotativo
- Navegação por swipe/toque
- Indicadores de navegação (dots)
- Transição suave entre slides

## Estado Atual (Screenshot)

O card exibe todas as provas empilhadas verticalmente, aumentando a altura do card e ocupando muito espaço vertical no grid.

## Solução Proposta

### 1. Nova Dependência

Instalar o plugin de autoplay do Embla Carousel:
```
embla-carousel-autoplay
```

### 2. Mudanças no `ExamTrackerCard.tsx` (modo compact)

Substituir a lista vertical por um carrossel usando os componentes existentes de `@/components/ui/carousel`:

```tsx
// Importações adicionais
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi
} from '@/components/ui/carousel';

// State para controlar slide atual
const [api, setApi] = React.useState<CarouselApi>();
const [current, setCurrent] = React.useState(0);

// Autoplay plugin (pausa ao hover)
const autoplayPlugin = useRef(
  Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
);

// Listener de navegação
useEffect(() => {
  if (!api) return;
  setCurrent(api.selectedScrollSnap());
  api.on("select", () => setCurrent(api.selectedScrollSnap()));
}, [api]);
```

### 3. Layout Visual do Carrossel

```text
┌──────────────────────────────────────┐
│ 🎓 Suas Provas                    +  │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ 🔴 Anatomia do Aparelho I... ⏱2d │ │
│ │ ─────────────── 33%      ⚡6/dia │ │
│ └──────────────────────────────────┘ │
│              ● ○ ○ ○                 │ ← Dots de navegação
├──────────────────────────────────────┤
│           Ver todas (4) →            │
└──────────────────────────────────────┘
```

### 4. Estrutura do JSX (Compact Mode)

```tsx
<CardContent className="pt-0 flex-1 flex flex-col min-h-0">
  <Carousel
    setApi={setApi}
    plugins={examInsights.length > 1 ? [autoplayPlugin.current] : []}
    opts={{ loop: true, align: 'start' }}
    className="w-full"
  >
    <CarouselContent className="-ml-2">
      {examInsights.map((insight, index) => (
        <CarouselItem key={insight.exam.id} className="pl-2 basis-full">
          {/* Card de prova - mesmo layout atual mas sem motion wrapper */}
          <div className={cn(
            "rounded-xl border p-3 cursor-pointer transition-all",
            getStatusBg(insight.status)
          )}>
            {/* Conteúdo do ExamItem inline */}
          </div>
        </CarouselItem>
      ))}
    </CarouselContent>
  </Carousel>
  
  {/* Dots de navegação (quando > 1 prova) */}
  {examInsights.length > 1 && (
    <div className="flex justify-center gap-1.5 pt-2">
      {examInsights.map((_, idx) => (
        <button
          key={idx}
          onClick={() => api?.scrollTo(idx)}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-all",
            idx === current 
              ? "bg-primary w-3" 
              : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
          )}
          aria-label={`Ir para prova ${idx + 1}`}
        />
      ))}
    </div>
  )}
  
  {/* Footer mantido */}
</CardContent>
```

### 5. Comportamentos Especiais

| Cenário | Comportamento |
|---------|---------------|
| 1 prova | Sem carrossel, layout atual simples |
| 2+ provas | Carrossel com autoplay e dots |
| Hover | Pausa autoplay |
| Swipe (mobile) | Navega entre slides |
| Click no dot | Vai para slide específico |
| Click no slide | Navega para `/guia-estudos?materia=X` |

### 6. Configuração do Autoplay

- **Delay**: 4000ms (4 segundos por slide)
- **Loop**: Infinito
- **Pause on hover**: Sim (melhor UX)
- **Stop on interaction**: Não (continua após swipe)

### 7. Animação dos Dots

O dot ativo terá largura maior (estilo Netflix/iOS):
```css
.active-dot { width: 12px; } /* pill shape */
.inactive-dot { width: 6px; } /* circle */
```

### 8. Respeito a `prefers-reduced-motion`

Se o usuário preferir movimento reduzido:
- Desabilitar autoplay
- Manter navegação manual funcional

```tsx
const shouldReduceMotion = useReducedMotion();
const plugins = shouldReduceMotion || examInsights.length <= 1 
  ? [] 
  : [autoplayPlugin.current];
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `package.json` | Adicionar `embla-carousel-autoplay` |
| `src/components/progress-hub/ExamTrackerCard.tsx` | Implementar carrossel no modo compact (linhas 188-320) |

## Resultado Esperado

- ✅ Card mantém altura fixa (não cresce com mais provas)
- ✅ Transição suave estilo Netflix entre provas
- ✅ Autoplay pausável ao hover
- ✅ Navegação por swipe no mobile
- ✅ Dots indicam prova atual e permitem navegação
- ✅ Acessibilidade mantida (keyboard navigation)
- ✅ Respeita `prefers-reduced-motion`

