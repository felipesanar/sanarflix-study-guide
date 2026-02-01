
# Ampliacao de Imagens no Modo Prova

## Objetivo

Implementar funcionalidade de lightbox/zoom para as imagens das questoes no Modo Prova, permitindo que o aluno clique na imagem para visualiza-la em tamanho maior em um overlay fullscreen.

---

## Analise do Estado Atual

**Onde as imagens aparecem:**
- `src/pages/ModoProva.tsx` (linhas 468-476): imagem do enunciado da questao
- Campo `imagem?: string` no tipo `Questao` (src/types/simulado.ts)

**Componente atual:**
```tsx
{questaoAtualData?.imagem && (
  <div className="mt-6">
    <img
      src={questaoAtualData.imagem}
      alt="Imagem da questão"
      className="max-w-full rounded-lg border"
    />
  </div>
)}
```

**Recursos disponiveis:**
- Componente `Dialog` do Radix UI ja existe em `src/components/ui/dialog.tsx`
- Icone `ZoomIn` disponivel no lucide-react
- Animacoes de fade/zoom ja configuradas no Dialog

---

## Solucao Proposta

### Abordagem

Criar um componente reutilizavel `ImageLightbox` que:
1. Exibe a imagem normalmente com indicador de clique (cursor pointer + icone de zoom)
2. Ao clicar, abre um Dialog fullscreen com a imagem ampliada
3. Permite fechar clicando fora, no X, ou pressionando Escape
4. Suporta gestos de pinch-to-zoom em mobile (via CSS touch-action)

### Integracao com Modo Prova

- Substituir a `<img>` atual pelo componente `ImageLightbox`
- Manter comportamento nativo quando nao houver imagem
- Garantir que o lightbox funcione mesmo fora do modo tela cheia

---

## Implementacao

### 1. Criar Componente ImageLightbox

**Arquivo:** `src/components/simulados/ImageLightbox.tsx`

**Props:**
| Prop | Tipo | Descricao |
|------|------|-----------|
| `src` | `string` | URL da imagem |
| `alt` | `string` | Texto alternativo |
| `className` | `string?` | Classes CSS extras para a thumbnail |

**Comportamento:**
- Thumbnail exibe imagem com hover state (cursor-pointer, overlay sutil com icone ZoomIn)
- Click abre Dialog fullscreen com fundo escuro (bg-black/95)
- Imagem ampliada ocupa ate 90vw x 90vh, mantendo proporcao
- Botao X para fechar no canto superior direito
- Fecha ao pressionar Escape (comportamento nativo do Dialog)
- Touch-friendly: permite scroll/zoom em dispositivos touch

**Componentes utilizados:**
- `Dialog`, `DialogContent`, `DialogClose` do Radix
- Icone `ZoomIn` do lucide-react

### 2. Integrar no ModoProva.tsx

**Alteracoes:**
1. Adicionar import do `ImageLightbox`
2. Substituir o bloco de imagem existente pelo novo componente

**Antes (linhas 468-476):**
```tsx
{questaoAtualData?.imagem && (
  <div className="mt-6">
    <img
      src={questaoAtualData.imagem}
      alt="Imagem da questão"
      className="max-w-full rounded-lg border"
    />
  </div>
)}
```

**Depois:**
```tsx
{questaoAtualData?.imagem && (
  <div className="mt-6">
    <ImageLightbox
      src={questaoAtualData.imagem}
      alt={`Imagem da questão ${questaoAtual + 1}`}
      className="max-w-full rounded-lg border"
    />
  </div>
)}
```

---

## Secao Tecnica

### Arquivos Criados

| Arquivo | Descricao |
|---------|-----------|
| `src/components/simulados/ImageLightbox.tsx` | Componente de lightbox reutilizavel |

### Arquivos Modificados

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/ModoProva.tsx` | Import e uso do ImageLightbox |

### Estrutura do Componente

```tsx
// ImageLightbox.tsx (estrutura simplificada)
import { useState } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';
import { ZoomIn, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageLightboxProps {
  src: string;
  alt: string;
  className?: string;
}

export const ImageLightbox = ({ src, alt, className }: ImageLightboxProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Thumbnail clicavel */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative group cursor-zoom-in"
        aria-label="Ampliar imagem"
      >
        <img src={src} alt={alt} className={className} />
        {/* Overlay com icone de zoom */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" />
        </div>
      </button>

      {/* Dialog fullscreen */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-transparent">
          <DialogClose className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2">
            <X className="h-6 w-6 text-white" />
          </DialogClose>
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[90vh] object-contain mx-auto"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
```

### Consideracoes de UX

1. **Indicador visual**: Overlay com icone ZoomIn aparece no hover
2. **Cursor**: `cursor-zoom-in` indica que a imagem e clicavel
3. **Acessibilidade**: `aria-label` no botao, alt text preservado
4. **Mobile**: Touch-friendly, sem conflito com scroll da pagina
5. **Escape**: Fecha automaticamente (comportamento nativo do Dialog)

### Consideracoes de Performance

- Imagem carrega apenas uma vez (mesmo src para thumbnail e ampliada)
- Dialog e lazy-rendered (so monta no DOM quando aberto)
- Animacoes leves via CSS (fade-in/zoom-in existentes)

---

## Validacao

1. Verificar que imagens da questao exibem indicador de zoom no hover
2. Clicar na imagem abre o lightbox fullscreen
3. Fechar via X, clique fora, ou Escape funciona
4. Imagem ampliada mantem proporcao e nao extrapola a tela
5. Funciona corretamente em dispositivos touch
6. Nao interfere com atalhos de teclado do Modo Prova (1-4, setas, F, Esc)
7. Funciona mesmo quando fora do modo tela cheia
