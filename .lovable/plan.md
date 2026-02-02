

# Plano: Adicionar Feedback Visual ao Botão "Baixar Gabarito"

## Diagnóstico

O botão "Baixar Gabarito" está **funcionando corretamente** - ele é desabilitado quando nenhum simulado específico está selecionado (linha 471 em SimuladoDesempenho.tsx):

```tsx
disabled={!selectedSimulado || isDownloadingPDF}
```

Isso é intencional porque:
- A "Visão Geral" agrega dados de **todos** os simulados realizados
- Para gerar um gabarito PDF, é necessário saber **qual simulado específico** exportar (questões, respostas, temas)
- Não faz sentido gerar um único gabarito misturando questões de múltiplos simulados

**O problema é de UX**: O usuário não tem indicação clara de **por que** o botão está desabilitado e **o que fazer** para habilitá-lo.

---

## Solução Proposta

Adicionar um **Tooltip** que explica ao usuário a ação necessária quando o botão está desabilitado.

### Implementação

Envolver o botão em um `Tooltip` condicional:

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span>
      <Button
        onClick={handleDownloadGabarito}
        disabled={!selectedSimulado || isDownloadingPDF}
        variant="outline"
        className="gap-2 w-full xs:w-auto"
      >
        {isDownloadingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        Baixar Gabarito
      </Button>
    </span>
  </TooltipTrigger>
  {!selectedSimulado && (
    <TooltipContent>
      <p>Selecione um simulado específico para baixar o gabarito</p>
    </TooltipContent>
  )}
</Tooltip>
```

**Nota técnica**: O `<span>` é necessário porque elementos desabilitados não disparam eventos de hover por padrão.

---

## Alterações por Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/SimuladoDesempenho.tsx` | Importar Tooltip, envolver botão com tooltip condicional |

---

## Seção Técnica

### Por que o Tooltip precisa de um wrapper span?

Botões desabilitados não disparam eventos de mouse (hover, focus) na maioria dos browsers. Para que o tooltip funcione em um botão desabilitado, é preciso envolvê-lo em um elemento que possa receber esses eventos.

### Componentes necessários

Importar do shadcn/ui:
```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
```

O componente Tooltip já existe no projeto (src/components/ui/tooltip.tsx) e é amplamente utilizado.

### Testes Recomendados

1. Acessar página de Desempenho com "Visão Geral" selecionada
2. Passar mouse sobre botão "Baixar Gabarito" desabilitado
3. Verificar que tooltip aparece com mensagem explicativa
4. Selecionar um simulado específico no dropdown
5. Verificar que botão fica habilitado e tooltip não aparece mais
6. Clicar e confirmar download do PDF

