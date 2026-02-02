
# Plano: Melhorar Responsividade da Aba Desempenho

## Problemas Identificados

### 1. Header com Botoes (linhas 418-445)
- Os botoes de acao (Select, Atualizar, Baixar Gabarito) nao empilham corretamente em mobile
- Causa overflow horizontal em telas pequenas
- O `flex items-center gap-4` mantem tudo na mesma linha

### 2. Componente Column (linha 166)
- `min-w-[250px]` forca largura minima que causa scroll horizontal em mobile
- Nao ajusta para telas menores que 768px

### 3. DecompositionTree (linha 192)
- Layout de 3 colunas com `min-w-[250px]` cada = 750px minimo
- Em mobile, as colunas ficam apertadas ou causam scroll

### 4. QuestionModal (linha 72)
- `max-w-2xl` (672px) pode ser muito grande em mobile
- Padding interno pode ser excessivo

### 5. Botoes de Navegacao do Modal (linhas 141-145)
- Em telas muito pequenas, os botoes "Anterior" e "Proxima" podem ficar apertados

---

## Solucao Proposta

### 1. Header Responsivo
**Arquivo:** `src/pages/SimuladoDesempenho.tsx` (linhas 418-445)

**Antes:**
```tsx
<div className="flex flex-wrap justify-between items-center gap-4">
  <div>...</div>
  <div className="flex items-center gap-4">
    {/* 3 botoes em linha */}
  </div>
</div>
```

**Depois:**
```tsx
<div className="flex flex-col sm:flex-row sm:flex-wrap justify-between items-start sm:items-center gap-4">
  <div>
    <h1 className="text-2xl sm:text-3xl font-bold">...</h1>
    ...
  </div>
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
    {/* Select ocupa largura total em mobile */}
    <div className="w-full sm:min-w-[200px] sm:w-auto">...</div>
    {/* Botoes empilham verticalmente em mobile */}
    <div className="flex flex-col xs:flex-row gap-2">
      {/* Atualizar e Baixar lado a lado em telas maiores */}
    </div>
  </div>
</div>
```

### 2. Column Component Responsivo
**Arquivo:** `src/pages/SimuladoDesempenho.tsx` (linha 166)

**Antes:**
```tsx
<div className="flex-1 min-w-[250px]">
```

**Depois:**
```tsx
<div className="flex-1 min-w-0 md:min-w-[200px] lg:min-w-[250px]">
```

### 3. DecompositionTree Layout
**Arquivo:** `src/pages/SimuladoDesempenho.tsx` (linha 192)

**Melhorias:**
- Em mobile: layout vertical com colunas empilhadas
- Em tablet: 2 colunas com terceira abaixo se necessario
- Em desktop: 3 colunas lado a lado

```tsx
<div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <Column title="Tema">...</Column>
  <Column title="Especialidade">...</Column>
  <Column title="Subespecialidade" className="sm:col-span-2 lg:col-span-1">...</Column>
</div>
```

### 4. QuestionModal Responsivo
**Arquivo:** `src/pages/SimuladoDesempenho.tsx` (linhas 70-149)

**Melhorias:**
```tsx
<DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col p-4 sm:p-6">
```

- Padding reduzido em mobile
- Largura responsiva com margem lateral

**Botoes de navegacao:**
```tsx
<div className="flex-shrink-0 pt-4 border-t flex flex-col xs:flex-row justify-between items-center gap-3">
  <Button variant="outline" onClick={handlePrev} disabled={currentIndex === 0} className="w-full xs:w-auto">
    <ChevronLeft className="h-4 w-4 mr-2" /> Anterior
  </Button>
  <span className="text-sm text-muted-foreground order-first xs:order-none">
    Questao {currentIndex + 1} de {questions.length}
  </span>
  <Button variant="outline" onClick={handleNext} disabled={currentIndex === questions.length - 1} className="w-full xs:w-auto">
    Proxima <ChevronRight className="h-4 w-4 ml-2" />
  </Button>
</div>
```

### 5. PerformanceSummary Texto Responsivo
**Arquivo:** `src/pages/SimuladoDesempenho.tsx` (linha 161)

**Melhorias:**
- Adicionar `text-sm sm:text-base` para textos longos
- Melhorar espacamento vertical em mobile

### 6. Graficos com Altura Responsiva
**Arquivo:** `src/pages/SimuladoDesempenho.tsx` (linhas 461, 223)

**Antes:**
```tsx
<CardContent className="h-[270px]">
```

**Depois:**
```tsx
<CardContent className="h-[220px] sm:h-[270px]">
```

---

## Resumo das Alteracoes

| Componente | Problema | Solucao |
|------------|----------|---------|
| Header | Botoes nao empilham | Flex-col em mobile, flex-row em sm+ |
| Column | min-w[250px] causa overflow | min-w-0 em mobile, progressivo em md/lg |
| DecompositionTree | 3 colunas fixas | Grid responsivo 1/2/3 colunas |
| QuestionModal | Muito largo em mobile | w-[95vw] max-w-2xl |
| Botoes do Modal | Apertados | Empilhar verticalmente em mobile |
| Graficos | Altura fixa | Altura responsiva h-[220px] sm:h-[270px] |
| Textos | Tamanho unico | text-sm sm:text-base |

---

## Secao Tecnica

### Breakpoints Utilizados
- **Mobile:** `<640px` (default)
- **sm:** `>=640px`
- **md:** `>=768px`
- **lg:** `>=1024px`

### Arquivos Modificados
- `src/pages/SimuladoDesempenho.tsx` (arquivo unico)

### Principios Aplicados
1. Mobile-first: estilos base para mobile, progressivamente maiores
2. Flexbox para alinhamento dinamico
3. Grid para layouts de colunas multiplas
4. Container queries para fontes dinamicas (ja existente)
5. Safe-area para dispositivos com notch

### Compatibilidade
- Todas as alteracoes usam classes Tailwind padrao
- Nenhuma dependencia adicional necessaria
- Mantém comportamento visual existente em desktop
