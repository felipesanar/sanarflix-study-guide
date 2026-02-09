
# Plano: Baixar Prova Revisada Completa

## Visão Geral

Criar uma nova funcionalidade **"Baixar Prova Revisada"** que gera um PDF completo e didático contendo:
- Todas as questões com enunciado completo
- Todas as alternativas com identificação visual clara
- Qual era a resposta correta vs. qual o aluno marcou
- Status de acerto/erro/não respondido
- Comentário pedagógico do professor
- Análise de desempenho geral

---

## Estrutura do PDF

### Página 1: Capa e Resumo Executivo

```
┌─────────────────────────────────────────────────────┐
│  [LOGO]   SANARFLIX ACADEMY                    Data │
│                                                     │
│         PROVA REVISADA COMPLETA                     │
│         Nome do Simulado                            │
├─────────────────────────────────────────────────────┤
│  ALUNO: Nome do Estudante                           │
│                                                     │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │  ACERTOS  │ │   ERROS   │ │ N/RESP    │          │
│  │    15     │ │     8     │ │    2      │          │
│  │   60%     │ │   32%     │ │   8%      │          │
│  └───────────┘ └───────────┘ └───────────┘          │
│                                                     │
│  DESEMPENHO POR ÁREA                                │
│  ├─ Clínica Médica ████████████ 75%                 │
│  ├─ Cirurgia       █████████░░░ 60%                 │
│  ├─ Pediatria      ██████░░░░░░ 45%                 │
│  └─ ...                                             │
└─────────────────────────────────────────────────────┘
```

### Páginas Seguintes: Questões Completas

Cada questão ocupa aproximadamente 1/2 a 1 página dependendo do tamanho:

```
┌─────────────────────────────────────────────────────┐
│ QUESTÃO 1                              [ACERTOU ✓]  │
│ Dificuldade: Médio    │    Área: Clínica Médica     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Paciente de 45 anos, sexo masculino, apresenta      │
│ dor torácica há 2 horas, com irradiação para membro │
│ superior esquerdo. Refere sudorese e náuseas...     │
│                                                     │
│ [IMAGEM - se houver]                                │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│   A) Realizar ECG imediatamente                     │ ← Alternativa normal
│      └─ [CORRETA ✓] [SUA RESPOSTA ✓]                │
│                                                     │
│   B) Solicitar radiografia de tórax                 │ ← Alternativa normal
│                                                     │
│   C) Prescrever analgésico e observar               │ ← Você marcou (ERRADA)
│      └─ [SUA RESPOSTA ✗]                            │
│                                                     │
│   D) Encaminhar para ambulatório                    │ ← Alternativa normal
│                                                     │
├─────────────────────────────────────────────────────┤
│ COMENTÁRIO DO PROFESSOR                             │
│                                                     │
│ A dor torácica com irradiação para MSE associada    │
│ a sudorese e náuseas é altamente sugestiva de...    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Página Final: Análise de Desempenho

```
┌─────────────────────────────────────────────────────┐
│              ANÁLISE DE DESEMPENHO                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ PONTOS FORTES                                       │
│ ─────────────                                       │
│ Sua principal fortaleza foi em Clínica Médica,      │
│ com 75% de acertos. Continue fortalecendo...        │
│                                                     │
│ OPORTUNIDADES DE MELHORIA                           │
│ ─────────────────────────                           │
│ A área com maior oportunidade de crescimento é      │
│ Pediatria (45%). Foque nos temas:                   │
│ • Neonatologia (30%)                                │
│ • Puericultura (40%)                                │
│                                                     │
│ ANÁLISE POR DIFICULDADE                             │
│ ─────────────────────────                           │
│ Fácil:   ████████████████ 80%                       │
│ Médio:   ██████████░░░░░░ 55%                       │
│ Difícil: ████░░░░░░░░░░░░ 30%                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Componentes Visuais das Alternativas

### Legenda de Cores

| Estado | Cor de Fundo | Ícone | Borda |
|--------|--------------|-------|-------|
| Correta (acertou) | Verde claro | ✓ Checkmark | Verde |
| Correta (não marcou) | Verde claro sutil | ✓ Checkmark | Verde tracejado |
| Errada (você marcou) | Vermelho claro | ✗ X | Vermelho |
| Não respondida | Cinza | ○ Círculo | Cinza tracejado |
| Questão anulada | Roxo claro | ⊘ Ban | Roxo |

### Badges de Status (Canto Superior Direito da Questão)

- **ACERTOU** — Badge verde com checkmark
- **ERROU** — Badge vermelho com X
- **NÃO RESPONDEU** — Badge amarelo/âmbar com círculo
- **ANULADA** — Badge roxo com símbolo de anulação

---

## Arquitetura Técnica

### Novo Arquivo: `src/utils/pdfProvaRevisada.ts`

Interface expandida:
```typescript
interface QuestaoRevisada {
  numero: number;
  enunciado: string;
  alternativas: {
    letra: 'A' | 'B' | 'C' | 'D' | 'E';
    texto: string;
    isCorreta: boolean;
    isMarcadaPeloAluno: boolean;
  }[];
  respostaAluno: string | null;
  gabarito: string;
  acertou: boolean | null; // null = não respondeu
  comentario: string | null;
  imagem: string | null;
  grandeArea: string;
  especialidade: string;
  tema: string;
  dificuldade: string;
  anulada: boolean;
}

interface ProvaRevisadaStats {
  acertos: number;
  erros: number;
  naoRespondidas: number;
  total: number;
  percentual: number;
  porArea: { area: string; acertos: number; total: number; percentual: number }[];
  porDificuldade: { nivel: string; acertos: number; total: number; percentual: number }[];
}
```

### Funções Principais

1. **`generateProvaRevisadaPDF`** — Orquestra a geração completa
2. **`drawCoverPage`** — Capa com resumo executivo
3. **`drawQuestionBlock`** — Renderiza uma questão completa
4. **`drawAlternativeRow`** — Renderiza uma alternativa com estados visuais
5. **`drawCommentSection`** — Renderiza o comentário do professor
6. **`drawAnalysisPage`** — Página final com análise pedagógica
7. **`loadImageAsBase64`** — Carrega imagens das questões (se houver)

### Modificações em `SimuladoDesempenho.tsx`

1. Adicionar novo botão **"Baixar Prova Revisada"** ao lado do botão existente
2. Nova função `handleDownloadProvaRevisada` que:
   - Busca questões completas com JOIN em `questoes_simulado`
   - Busca respostas do aluno em `answer_progress`
   - Calcula estatísticas por área e dificuldade
   - Chama `generateProvaRevisadaPDF`

---

## Query de Dados

```typescript
const { data: questoesCompletas } = await supabase
  .from('questoes_simulado')
  .select(`
    id, ordem, enunciado, 
    alternativa_a, alternativa_b, alternativa_c, alternativa_d, alternativa_e,
    correta, comentario, imagem,
    grande_area, especialidade, tema, grau_dificuldade, anulada
  `)
  .eq('simulado_id', selectedSimulado)
  .order('ordem', { ascending: true });

const { data: respostasAluno } = await supabase
  .from('answer_progress')
  .select('question_id, resposta_usuario, correct')
  .eq('simulado', selectedSimulado)
  .eq('user_id', user.id);
```

---

## UI do Botão (Dropdown com Opções)

Substituir o botão único por um dropdown com duas opções:

```
┌─────────────────────────────────────────┐
│  [▼ Baixar PDF]                         │
├─────────────────────────────────────────┤
│  📄 Gabarito Resumido                   │
│     Tabela simples com respostas        │
├─────────────────────────────────────────┤
│  📚 Prova Revisada Completa      ★ NOVO │
│     Questões completas + comentários    │
└─────────────────────────────────────────┘
```

---

## Considerações de Performance

### Imagens nas Questões

- Carregar imagens de forma assíncrona em paralelo
- Converter para base64 antes de adicionar ao PDF
- Fallback se imagem falhar (placeholder ou omitir)
- Limite de 5 questões com imagem por vez para evitar travamento

### Tamanho do PDF

- Estimativa: 50 questões ≈ 30-50 páginas
- Tempo de geração: 5-15 segundos dependendo de imagens
- Mostrar progress bar durante geração

### Feedback Visual

```typescript
// Estados durante geração
'preparing' → 'loading_questions' → 'loading_images' → 'generating' → 'complete'

// Toast com progresso
toast({ title: 'Gerando PDF...', description: 'Carregando questões (12/50)' });
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/utils/pdfProvaRevisada.ts` | CRIAR — Nova engine de PDF |
| `src/pages/SimuladoDesempenho.tsx` | MODIFICAR — Adicionar dropdown e nova função |

---

## Checklist de Validação

- [ ] PDF gera corretamente com todas as questões
- [ ] Alternativas mostram cores corretas (correta/errada/não marcada)
- [ ] Comentários do professor aparecem formatados
- [ ] Imagens das questões são incluídas (quando existem)
- [ ] Questões anuladas mostram badge especial
- [ ] Página de análise resume desempenho por área
- [ ] Nomes de arquivo são seguros (sem caracteres especiais)
- [ ] Progress feedback durante geração longa
- [ ] Funciona em simulados grandes (50+ questões)
- [ ] Light mode e dark mode do app não afetam o PDF (PDF sempre com cores fixas)
