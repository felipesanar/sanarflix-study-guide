

# Plano de Melhoria Robusta dos PDFs de Simulados

## Diagnostico dos Problemas Atuais

Apos analise detalhada dos dois arquivos de geracao de PDF (`pdfProvaRevisada.ts` com 992 linhas e `pdfGabarito.ts` com 739 linhas), identifiquei os seguintes problemas de formatacao e UX:

### Problemas Criticos de Formatacao

1. **Letra descentralizada no circulo vinho** (screenshot do usuario)
   - No `drawAlternative` (linha 606), o offset vertical `letterCenterY + 3` esta incorreto - a letra fica deslocada para baixo do centro do circulo
   - O jsPDF usa baseline como referencia de texto; o correto e usar `letterCenterY + fontSize * 0.35` (aprox. 1/3 do tamanho da fonte)

2. **Texto das alternativas desalinhado verticalmente com o circulo**
   - O texto comeca em `y + padding + 5` (linha 613) mas nao esta alinhado com o centro visual do circulo
   - Quando ha apenas uma linha de texto, ela nao fica na mesma altura da letra no circulo

3. **Quebra de texto imprecisa nas alternativas**
   - O `textMaxWidth` (linha 580) subtrai espaco para o label badge, mas apenas na primeira linha - as linhas subsequentes tambem ficam estreitas desnecessariamente
   - Textos longos com palavras grandes podem gerar linhas muito curtas

4. **Imagens das questoes com proporcao fixa (hardcoded)**
   - Largura e altura fixas (`120 x 60`, linha 705-706) distorcem imagens que nao sao 2:1
   - Nao ha calculo de aspect ratio

### Problemas de Layout e Espacamento

5. **Espacamento inconsistente entre questoes**
   - O separador horizontal (linhas 780-785) usa offsets fixos que criam espacos irregulares dependendo do conteudo anterior

6. **Comentario do professor - box pode ser cortado**
   - O calculo de altura do comment box (linha 747) nao contabiliza adequadamente textos muito longos que podem exceder a pagina

7. **Capa da Prova Revisada - posicoes hardcoded**
   - Areas de desempenho comecam em `sectionY = 180` (linha 455) sem verificar se os stats cards ja ultrapassaram esse ponto
   - Com nomes longos ou muitas areas, pode haver sobreposicao

8. **PDF Gabarito - progress bar pode exceder o card**
   - A barra de progresso no card de identificacao (linhas 354-360) tem calculo fragil de largura

### Problemas de Qualidade Visual

9. **Gradiente do header com poucos steps (20)**
   - Com apenas 20 retangulos, o gradiente fica visivelmente "escalonado" em telas de alta resolucao

10. **Badges de status muito pequenos**
    - Os badges ACERTOU/ERROU/N-RESP tem apenas 7px de altura (linha 510) e 28px de largura - dificeis de ler

11. **Fontes muito pequenas em areas importantes**
    - Meta informacoes como dificuldade e area (8pt, linha 667) sao dificeis de ler

12. **Falta de espacamento vertical (breathing room)**
    - Elementos estao muito proximos uns dos outros, criando sensacao de "compressao"

---

## Solucao Proposta

### Arquivo: `src/utils/pdfProvaRevisada.ts`

#### 1. Corrigir centralizacao da letra no circulo (Critico)
- Calcular offset vertical baseado na metrica real da fonte: `letterCenterY + fontSize * 0.32` em vez de `+ 3`
- Aumentar levemente o raio do circulo de 5 para 5.5 para melhor proporcao letra/circulo
- Usar `{ align: 'center', baseline: 'middle' }` se suportado, ou calcular manualmente

#### 2. Alinhar texto da alternativa com o circulo
- Garantir que a primeira linha de texto comece na mesma altura vertical do centro do circulo
- Ajustar o `y` do texto para `letterCenterY - lineHeight * 0.1` quando ha apenas uma linha

#### 3. Corrigir calculo de largura do texto nas alternativas
- Calcular `textMaxWidth` sem descontar o label badge para linhas apos a primeira
- O label badge fica no canto superior direito e so afeta a primeira linha
- Implementar wrap em duas fases: primeira linha com desconto do badge, demais linhas com largura completa

#### 4. Calculo de aspect ratio para imagens
- Usar `doc.getImageProperties()` apos carregar a imagem para obter dimensoes reais
- Calcular a altura proporcionalmente: `imgHeight = imgWidth * (naturalHeight / naturalWidth)`
- Limitar altura maxima a 100mm para evitar paginas inteiras de imagem

#### 5. Melhorar gradiente do header
- Aumentar steps de 20 para 40 para transicao mais suave

#### 6. Aumentar tamanho dos badges de status
- Largura de 28 para 32px
- Altura de 7 para 8px
- Fonte de 7 para 7.5pt

#### 7. Aumentar espacamentos gerais
- Gap entre alternativas de 4 para 5mm
- Gap apos enunciado de 6 para 8mm
- Gap apos comentario de 8 para 10mm
- Padding interno das alternativas de 5 para 6mm

#### 8. Proteger contra overflow de pagina no comentario
- Verificar se o comentario cabe na pagina antes de desenhar
- Se nao couber, quebrar em duas partes ou mover para nova pagina

#### 9. Tornar posicoes da capa dinamicas
- Calcular `sectionY` baseado na posicao real apos os stats cards em vez de hardcoded 180

### Arquivo: `src/utils/pdfGabarito.ts`

#### 10. Harmonizar estilos com o PDF de Prova Revisada
- Usar a mesma paleta de cores e funcoes helper (DRY)
- Remover variaveis nao utilizadas (`k`, `hp` no `drawRoundedRect`)

#### 11. Melhorar tabela de gabarito
- Aumentar altura das linhas de 9 para 10mm
- Centralizar melhor os badges ACERTOU/ERROU nas celulas
- Melhorar contraste dos temas truncados

---

## Secao Tecnica

### Correcao principal - Centralizacao da letra (antes/depois)

Antes (incorreto):
```text
doc.text(alt.letra, letterCenterX, letterCenterY + 3, { align: 'center' });
```

Depois (correto):
```text
// jsPDF text y = baseline position
// Para centralizar verticalmente: center + (capHeight / 2)
// capHeight ~= fontSize * 0.35 para Helvetica Bold
const verticalOffset = 9 * 0.35 * 0.7; // ~2.2mm
doc.text(alt.letra, letterCenterX, letterCenterY + verticalOffset, { align: 'center' });
```

### Arquivos modificados
- `src/utils/pdfProvaRevisada.ts` - Correcoes de formatacao, espacamento e layout
- `src/utils/pdfGabarito.ts` - Harmonizacao visual e correcoes menores

### Impacto
- Zero impacto em funcionalidades existentes
- Melhoria puramente visual/formatacao
- Ambos os PDFs (Gabarito e Prova Revisada) serao aprimorados

