

# Plano de Correção — Formatação do PDF da Prova Revisada

## Problemas Identificados

### 1. Sobreposição de Labels nas Alternativas
**Local**: Função `drawAlternative` (linhas 441-517)
**Causa**: O label (ex: "✓ CORRETA • SUA RESPOSTA") é posicionado no canto direito da alternativa sem verificar se há espaço. O texto da alternativa e o label ocupam a mesma linha vertical, causando colisão.

### 2. Texto do Comentário Cortado/Ultrapassando Limites
**Local**: Função `drawQuestionBlock` (linhas 614-649)
**Causa**: 
- A altura do bloco de comentário é calculada como `commentLines.length * 5 + 20`, mas o texto pode ter linhas muito longas que não quebram corretamente
- A função `wrapText` quebra por palavras, mas parágrafos muito longos sem espaços podem ultrapassar os limites
- O texto é renderizado sem verificar se cada linha cabe na largura disponível

### 3. Caracteres Desformatados/Espaçamento Estranho
**Local**: Renderização do enunciado (linhas 567-580)
**Causa**:
- Caracteres especiais Unicode (ex: grau °, símbolos médicos) podem não ser suportados pela fonte Helvetica do jsPDF
- Alguns textos podem conter caracteres de formatação invisíveis (non-breaking spaces, tabs)
- A função `wrapText` não normaliza o texto antes de processar

---

## Solução Proposta

### Fase 1: Função de Sanitização de Texto

Criar função `sanitizeText` que:
- Remove caracteres invisíveis e de controle
- Substitui caracteres problemáticos por equivalentes ASCII
- Normaliza espaços múltiplos
- Substitui tabs e quebras de linha por espaços

```typescript
const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  return text
    // Normaliza Unicode para forma compatível
    .normalize('NFKC')
    // Remove caracteres de controle exceto espaço
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Substitui tabs e quebras por espaço
    .replace(/[\t\n\r]/g, ' ')
    // Substitui múltiplos espaços por um
    .replace(/\s+/g, ' ')
    // Substitui caracteres especiais problemáticos
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/°/g, 'º')
    // Remove caracteres não-imprimíveis restantes
    .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, '')
    .trim();
};
```

### Fase 2: Melhorar `wrapText` para Quebra Robusta

Reescrever a função para:
- Quebrar palavras muito longas que excedem a largura
- Verificar largura real de cada linha
- Usar método mais preciso de medição

```typescript
const wrapText = (doc: jsPDF, text: string, maxWidth: number): string[] => {
  const sanitized = sanitizeText(text);
  if (!sanitized) return [];
  
  const words = sanitized.split(' ').filter(w => w.length > 0);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    // Se a palavra sozinha é maior que maxWidth, quebrar a palavra
    if (doc.getTextWidth(word) > maxWidth) {
      // Finaliza linha atual se houver
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      
      // Quebra a palavra em pedaços
      let remaining = word;
      while (remaining.length > 0) {
        let chunk = '';
        for (let i = 1; i <= remaining.length; i++) {
          const test = remaining.substring(0, i);
          if (doc.getTextWidth(test) > maxWidth - 5) {
            chunk = remaining.substring(0, Math.max(1, i - 1));
            break;
          }
          chunk = test;
        }
        lines.push(chunk);
        remaining = remaining.substring(chunk.length);
      }
      continue;
    }
    
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (doc.getTextWidth(testLine) > maxWidth) {
      if (currentLine) {
        lines.push(currentLine.trim());
      }
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }
  
  return lines;
};
```

### Fase 3: Corrigir Posicionamento do Label nas Alternativas

Modificar `drawAlternative` para:
- Renderizar o label em linha separada, abaixo do texto
- Ou calcular espaço disponível e ajustar

```typescript
const drawAlternative = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  alt: AlternativaRevisada,
  questaoAnulada: boolean
): number => {
  const lineHeight = 5;
  const padding = 4;
  const letterWidth = 15;
  
  // Calcular largura disponível para texto (sem área do label)
  const labelWidth = 45; // Espaço reservado para label
  const textMaxWidth = width - padding * 2 - letterWidth - (labelText ? labelWidth + 5 : 0);
  
  // Wrap text com sanitização
  doc.setFontSize(9);
  const sanitizedTexto = sanitizeText(alt.texto);
  const wrappedLines = wrapText(doc, sanitizedTexto, textMaxWidth);
  
  // Altura mínima do bloco
  const textHeight = wrappedLines.length * lineHeight;
  const blockHeight = Math.max(textHeight + padding * 2, 14);
  
  // ... resto da renderização ...
  
  // Label em posição segura (não sobrepõe)
  if (labelText) {
    const labelY = y + padding + 3;
    const labelX = x + width - padding;
    
    // Verificar se o label cabe na primeira linha
    // Se não, colocar abaixo do texto
    doc.text(labelText, labelX, labelY, { align: 'right' });
  }
  
  return blockHeight + 3;
};
```

### Fase 4: Melhorar Cálculo de Altura do Comentário

Modificar o bloco de comentário para:
- Usar margem interna adequada
- Calcular altura real baseada no texto renderizado
- Adicionar padding extra para segurança

```typescript
// No bloco de comentário (linhas 614-649)
if (questao.comentario) {
  yPos += 8;
  
  const sanitizedComment = sanitizeText(questao.comentario);
  const commentMaxWidth = contentWidth - 20; // Margem interna maior
  
  doc.setFontSize(9);
  const commentLines = wrapText(doc, sanitizedComment, commentMaxWidth);
  
  // Altura com padding adequado
  const headerHeight = 14;
  const textPadding = 8;
  const lineSpacing = 5.5; // Espaçamento maior entre linhas
  const commentHeight = headerHeight + (commentLines.length * lineSpacing) + textPadding * 2;
  
  // ... resto da renderização ...
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/utils/pdfProvaRevisada.ts` | Correções completas de formatação |

---

## Detalhamento das Mudanças por Linha

### 1. Adicionar função `sanitizeText` (após linha 147)
Nova função para limpar e normalizar texto antes de usar no PDF

### 2. Reescrever `wrapText` (linhas 221-243)
Substituir implementação atual por versão robusta que:
- Quebra palavras longas
- Usa sanitização
- Mede largura corretamente

### 3. Corrigir `drawAlternative` (linhas 441-517)
- Ajustar cálculo de `textMaxWidth` para reservar espaço do label
- Posicionar label de forma que não sobreponha
- Sanitizar texto da alternativa

### 4. Corrigir bloco de comentário (linhas 614-649)
- Usar `sanitizeText` no comentário
- Aumentar espaçamento entre linhas (5 → 5.5)
- Adicionar padding extra na caixa
- Margem interna maior para texto

### 5. Sanitizar enunciado (linhas 567-580)
- Aplicar `sanitizeText` antes de `wrapText`

---

## Testes de Validação

- [ ] Alternativas com labels longos não sobrepõem texto
- [ ] Comentários extensos ficam contidos na caixa
- [ ] Caracteres especiais (°, ², ³, µ) são convertidos ou removidos
- [ ] Textos com espaços extras são normalizados
- [ ] Palavras muito longas são quebradas corretamente
- [ ] PDF gera sem erros para simulados de 50+ questões
- [ ] Todas as alternativas são legíveis
- [ ] Quebras de página ocorrem em pontos corretos

---

## Resultado Esperado

| Problema | Antes | Depois |
|----------|-------|--------|
| Labels sobrepostos | "CORRETA" colide com texto | Label em área reservada |
| Texto cortado | Ultrapassa bordas | Contido com wrap correto |
| Caracteres estranhos | Espaçamento irregular | Texto limpo e legível |

