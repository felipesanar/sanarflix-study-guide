

# Plano: Gabarito PDF Premium com Identidade Visual SanarFlix Academy

## Visao Geral

Redesign completo do PDF de gabarito, elevando a qualidade visual para nivel premium com a identidade visual do SanarFlix Academy. O documento tera aparencia profissional e institucional, utilizando as cores oficiais, logo e elementos visuais sofisticados.

---

## Estado Atual vs. Proposta

| Elemento | Atual | Proposto |
|----------|-------|----------|
| **Header** | Retangulo azul simples, texto "GABARITO" | Header com gradiente wine, logo SanarFlix Academy, nome da marca e linha decorativa |
| **Cores** | Azul indigo generico (#4F46E5) | Wine institucional (#8B1538) + Blue accent (#1976D2) |
| **Tipografia** | Tamanhos fixos, sem hierarquia | Hierarquia clara, tamanhos proporcionais, tracking ajustado |
| **Tabela** | Linhas alternadas simples | Bordas arredondadas visuais, icones de status (checkmark/X), badges coloridos |
| **Resumo** | Lista simples | Cards visuais com icones, barras de progresso |
| **Rodape** | Inexistente | Rodape com data, URL do Academy e marca d'agua |

---

## Paleta de Cores do PDF

```text
Cores Primarias:
- Wine Primary:     #8B1538 (RGB: 139, 21, 56)
- Wine Dark:        #6B1028 (RGB: 107, 16, 40)
- Wine Light:       #A91D46 (RGB: 169, 29, 70)

Cores Secundarias:
- Blue Accent:      #1976D2 (RGB: 25, 118, 210)
- Blue Light:       #42A5F5 (RGB: 66, 165, 245)

Status:
- Success Green:    #059669 (RGB: 5, 150, 105)
- Success Light:    #D1FAE5 (RGB: 209, 250, 229)
- Error Red:        #DC2626 (RGB: 220, 38, 38)
- Error Light:      #FEE2E2 (RGB: 254, 226, 226)
- Neutral Gray:     #6B7280 (RGB: 107, 114, 128)
- Neutral Light:    #F3F4F6 (RGB: 243, 244, 246)

Textos:
- Text Dark:        #1F2937 (RGB: 31, 41, 55)
- Text Muted:       #6B7280 (RGB: 107, 114, 128)
```

---

## Estrutura do Novo PDF

### 1. HEADER PREMIUM

```text
+--------------------------------------------------------------------------+
|  [LOGO]  SanarFlix Academy                          Data: 02 de Fevereiro|
|          Para Universidades Parceiras                              2026  |
+--------------------------------------------------------------------------+
|                                                                          |
|                            GABARITO COMPLETO                             |
|                         Nome do Simulado Aqui                            |
|                                                                          |
+--------------------------------------------------------------------------+
```

**Implementacao:**
- Fundo com gradiente wine (#8B1538 para #6B1028)
- Logo SanarFlix Academy embarcada como base64 (imagem PNG convertida)
- Tipografia "SanarFlix Academy" em branco, bold
- Subtitulo "Para Universidades Parceiras" em branco/80% opacidade
- Titulo "GABARITO COMPLETO" centralizado, maior destaque
- Nome do simulado abaixo

### 2. CARD DE IDENTIFICACAO

```text
+--------------------------------------------------------------------------+
|  ALUNO                                    RESULTADO                      |
|  Nome do Estudante                        42/60 questoes                 |
|  email@universidade.edu                   70% de aproveitamento          |
|                                           [###########------] Progresso  |
+--------------------------------------------------------------------------+
```

**Implementacao:**
- Fundo cinza claro (#F9FAFB) com borda sutil
- Duas colunas: dados do aluno (esquerda) e resultado (direita)
- Barra de progresso visual (retangulos preenchidos)
- Cores de acordo com percentual (verde > 70%, amarelo 50-70%, vermelho < 50%)

### 3. TABELA DE QUESTOES PREMIUM

```text
+------+----------+----------+------------+--------------------------------+
| #    | SUA RESP | GABARITO | RESULTADO  | TEMA                           |
+------+----------+----------+------------+--------------------------------+
|  1   |    A     |    A     | ✓ ACERTOU  | Cardiologia - Arritmias        |
+------+----------+----------+------------+--------------------------------+
|  2   |    C     |    B     | ✗ ERROU    | Neurologia - AVC               |
+------+----------+----------+------------+--------------------------------+
|  3   |    -     |    D     | ⊘ N/RESP   | Pneumologia - DPOC             |
+------+----------+----------+------------+--------------------------------+
```

**Implementacao:**
- Header da tabela com gradiente wine
- Alternancia de cores de fundo (branco / cinza muito claro)
- Coluna "Resultado":
  - ACERTOU: Texto verde com fundo verde claro (#D1FAE5)
  - ERROU: Texto vermelho com fundo vermelho claro (#FEE2E2)
  - N/RESP: Texto cinza com fundo cinza claro
- Bordas arredondadas simuladas com desenho customizado
- Icones desenhados com primitivas do jsPDF (circulos, linhas)

### 4. RESUMO VISUAL

```text
+--------------------------------------------------------------------------+
|                           RESUMO DO DESEMPENHO                           |
+--------------------------------------------------------------------------+
|                                                                          |
|  +------------------+  +------------------+  +------------------+        |
|  |   ✓ 42           |  |   ✗ 15           |  |   ⊘ 3            |        |
|  |   ACERTOS        |  |   ERROS          |  |   NAO RESPONDIDAS|        |
|  +------------------+  +------------------+  +------------------+        |
|                                                                          |
|  +--------------------------------------------------------------------+ |
|  |  DESEMPENHO POR AREA                                               | |
|  |                                                                    | |
|  |  Cardiologia     ████████████████░░░░  80%                        | |
|  |  Neurologia      ███████████░░░░░░░░░  55%                        | |
|  |  Pneumologia     ██████████████████░░  90%                        | |
|  +--------------------------------------------------------------------+ |
|                                                                          |
+--------------------------------------------------------------------------+
```

**Implementacao:**
- Tres cards com numeros grandes e labels
- Cada card com cor de fundo correspondente (verde/vermelho/cinza)
- Barras de progresso por area/tema (se dados disponiveis)

### 5. RODAPE INSTITUCIONAL

```text
+--------------------------------------------------------------------------+
|  Gerado por SanarFlix Academy | sanarflix-study-guide.lovable.app       |
|  Este documento e confidencial e de uso exclusivo do aluno.              |
+--------------------------------------------------------------------------+
```

**Implementacao:**
- Linha divisoria fina acima
- Logo pequena ou icone
- URL do Academy
- Aviso de confidencialidade
- Presente em todas as paginas

---

## Implementacao Tecnica

### Arquivo: `src/utils/pdfGabarito.ts`

**Novas funcoes auxiliares:**
```typescript
// Converter imagem para base64 (feito em build time ou hardcoded)
const SANARFLIX_LOGO_BASE64 = 'data:image/png;base64,...';

// Desenhar retangulo arredondado (jsPDF nao tem nativo)
const roundedRect = (doc: jsPDF, x: number, y: number, w: number, h: number, r: number, style: 'F' | 'S' | 'FD') => { ... }

// Desenhar barra de progresso
const drawProgressBar = (doc: jsPDF, x: number, y: number, width: number, percentage: number, color: [number, number, number]) => { ... }

// Desenhar icone de check/x
const drawStatusIcon = (doc: jsPDF, x: number, y: number, status: 'correct' | 'wrong' | 'unanswered') => { ... }

// Gradiente simulado (multiplos retangulos)
const drawGradientHeader = (doc: jsPDF, height: number) => { ... }
```

**Paleta de cores como constantes:**
```typescript
const COLORS = {
  wine: { primary: [139, 21, 56], dark: [107, 16, 40], light: [169, 29, 70] },
  blue: { primary: [25, 118, 210], light: [66, 165, 245] },
  success: { main: [5, 150, 105], bg: [209, 250, 229] },
  error: { main: [220, 38, 38], bg: [254, 226, 226] },
  neutral: { main: [107, 114, 128], bg: [243, 244, 246], white: [255, 255, 255] },
  text: { dark: [31, 41, 55], muted: [107, 114, 128] }
};
```

### Funcao Principal Refatorada

```typescript
export const generateGabaritoPDF = (
  simuladoNome: string,
  alunoNome: string,
  questoes: GabaritoQuestao[],
  stats: GabaritoStats
): void => {
  const doc = new jsPDF();
  
  // 1. Desenhar header premium com logo
  drawPremiumHeader(doc, simuladoNome);
  
  // 2. Card de identificacao
  drawIdentificationCard(doc, alunoNome, stats);
  
  // 3. Tabela de questoes
  drawQuestionsTable(doc, questoes);
  
  // 4. Resumo visual
  drawSummarySection(doc, questoes, stats);
  
  // 5. Rodape em todas as paginas
  addFooterToAllPages(doc);
  
  doc.save(`gabarito_${safeFileName}.pdf`);
};
```

---

## Logo Embarcada

Para incluir a logo no PDF, sera necessario converter a imagem para base64. O arquivo `public/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png` sera embarcado como string constante no codigo.

**Processo:**
1. A logo ja existe em PNG
2. Converter para base64 e armazenar como constante no arquivo
3. Usar `doc.addImage()` com a string base64

---

## Resumo de Alteracoes

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/utils/pdfGabarito.ts` | Reescrita completa | Novo design premium com logo, gradientes, cores institucionais e layout profissional |

---

## Beneficios

1. **Identidade Visual**: PDF com cara de documento oficial SanarFlix Academy
2. **Profissionalismo**: Alunos podem compartilhar ou imprimir com orgulho
3. **Consistencia**: Mesmas cores e elementos visuais do app
4. **Legibilidade**: Hierarquia visual clara, cores de status intuitivas
5. **Institucional**: Logo e branding reforçam a marca
