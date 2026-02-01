
# Geracao de Gabarito em PDF na Pagina de Desempenho

## Objetivo

Adicionar funcionalidade para gerar e baixar um PDF contendo o gabarito completo do simulado selecionado, incluindo:
- Informacoes do simulado (nome, data)
- Lista de questoes com: numero, resposta do aluno, gabarito correto, resultado (acertou/errou)
- Resumo estatistico (total de questoes, acertos, percentual)

---

## Analise do Estado Atual

**Pagina de Desempenho (`SimuladoDesempenho.tsx`):**
- Exibe performance do aluno por simulado selecionado
- Utiliza RPC `get_user_performance_aggregates` para estatisticas
- Tem seletor de simulado (`selectedSimulado`)
- Dados disponiveis: `stats`, `ranking`, `simulados`

**Dados no Banco:**
- `questoes_simulado`: enunciado, alternativas, correta, tema, especialidade
- `answer_progress`: user_id, simulado, question_id, resposta_usuario, correct
- `simulados_admin`: id, nome

**Dependencias Atuais:**
- Nao ha biblioteca de PDF instalada (jsPDF ou similar)

---

## Solucao Proposta

### Abordagem

1. Adicionar dependencia `jspdf` para geracao de PDF no cliente
2. Criar funcao utilitaria para gerar PDF de gabarito
3. Adicionar botao "Baixar Gabarito PDF" na pagina de desempenho
4. Consultar dados das questoes e respostas do aluno para o simulado selecionado
5. Gerar PDF formatado com tabela de gabarito

### Estrutura do PDF

```text
+--------------------------------------------------+
|           GABARITO - [Nome do Simulado]          |
|              Data: DD/MM/AAAA                    |
+--------------------------------------------------+
|  Aluno: [Nome]        Acertos: XX/XX (XX%)       |
+--------------------------------------------------+
| # | Sua Resposta | Gabarito | Resultado | Tema   |
|---|--------------|----------|-----------|--------|
| 1 |      A       |    B     |   ERROU   | Cardio |
| 2 |      C       |    C     |  ACERTOU  | Neuro  |
| 3 |      -       |    D     |   N/R     | Trauma |
+--------------------------------------------------+
```

---

## Implementacao

### 1. Instalar Dependencia

Adicionar `jspdf` ao projeto:
```bash
npm install jspdf
```

### 2. Criar Utilitario de Geracao de PDF

**Arquivo:** `src/utils/pdfGabarito.ts`

**Funcoes:**
| Funcao | Descricao |
|--------|-----------|
| `generateGabaritoPDF` | Gera e baixa o PDF com os dados do gabarito |

**Parametros da funcao:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `simuladoNome` | `string` | Nome do simulado |
| `alunoNome` | `string` | Nome do aluno |
| `questoes` | `GabaritoQuestao[]` | Array com dados das questoes |
| `stats` | `{ acertos, total, percentual }` | Estatisticas gerais |

**Interface GabaritoQuestao:**
```typescript
interface GabaritoQuestao {
  numero: number;
  respostaAluno: string | null;
  gabarito: string;
  acertou: boolean | null; // null = nao respondida
  tema: string;
}
```

### 3. Buscar Dados para o PDF

Criar funcao para buscar questoes e respostas do simulado selecionado:

```typescript
const fetchGabaritoData = async (simuladoId: string, userId: string) => {
  const { data, error } = await supabase
    .from('answer_progress')
    .select(`
      question_id,
      resposta_usuario,
      correct,
      questoes_simulado (
        correta,
        tema,
        enunciado
      )
    `)
    .eq('simulado', simuladoId)
    .eq('user_id', userId)
    .order('question_id');
    
  return data;
};
```

### 4. Integrar na Pagina de Desempenho

**Alteracoes em `SimuladoDesempenho.tsx`:**

1. Importar utilitario e icone
2. Adicionar estado para loading do download
3. Criar handler para gerar PDF
4. Adicionar botao na UI (ao lado de "Atualizar Dados")

**Posicao do botao:**
```tsx
<div className="flex items-center gap-4">
  <Select ...>
  
  <Button 
    onClick={handleDownloadGabarito}
    disabled={!selectedSimulado || isDownloadingPDF}
    variant="outline"
    className="gap-2"
  >
    <FileDown className="h-4 w-4" />
    Baixar Gabarito
  </Button>
  
  <button onClick={handleRefresh}>Atualizar Dados</button>
</div>
```

**Comportamento:**
- Botao desabilitado quando "Visao Geral" esta selecionada (precisa de simulado especifico)
- Loading state enquanto gera PDF
- Toast de sucesso/erro apos download

---

## Secao Tecnica

### Arquivos Criados

| Arquivo | Descricao |
|---------|-----------|
| `src/utils/pdfGabarito.ts` | Utilitario para geracao de PDF de gabarito |

### Arquivos Modificados

| Arquivo | Alteracoes |
|---------|------------|
| `src/pages/SimuladoDesempenho.tsx` | Import, estado, handler, botao UI |
| `package.json` | Adicionar dependencia jspdf |

### Estrutura do Utilitario

```typescript
// pdfGabarito.ts
import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface GabaritoQuestao {
  numero: number;
  respostaAluno: string | null;
  gabarito: string;
  acertou: boolean | null;
  tema: string;
}

export interface GabaritoStats {
  acertos: number;
  total: number;
  percentual: number;
}

export const generateGabaritoPDF = (
  simuladoNome: string,
  alunoNome: string,
  questoes: GabaritoQuestao[],
  stats: GabaritoStats
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Cabecalho
  doc.setFontSize(18);
  doc.text('GABARITO', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text(simuladoNome, pageWidth / 2, 30, { align: 'center' });
  
  // Informacoes do aluno
  doc.setFontSize(10);
  doc.text(`Aluno: ${alunoNome}`, 14, 45);
  doc.text(`Data: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 52);
  doc.text(`Resultado: ${stats.acertos}/${stats.total} (${stats.percentual}%)`, pageWidth - 14, 45, { align: 'right' });
  
  // Tabela de questoes (manual, sem autotable para manter bundle leve)
  let yPos = 65;
  const lineHeight = 8;
  const colWidths = [15, 30, 25, 30, 80];
  const headers = ['#', 'Resposta', 'Gabarito', 'Resultado', 'Tema'];
  
  // Header da tabela
  doc.setFillColor(79, 70, 229); // primary color
  doc.rect(14, yPos, pageWidth - 28, lineHeight, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  
  let xPos = 14;
  headers.forEach((header, i) => {
    doc.text(header, xPos + 2, yPos + 5.5);
    xPos += colWidths[i];
  });
  
  yPos += lineHeight;
  doc.setTextColor(0, 0, 0);
  
  // Linhas de dados
  questoes.forEach((q, index) => {
    // Nova pagina se necessario
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    
    // Cor de fundo alternada
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, yPos, pageWidth - 28, lineHeight, 'F');
    }
    
    xPos = 14;
    const resultado = q.acertou === null ? 'N/R' : (q.acertou ? 'ACERTOU' : 'ERROU');
    const resposta = q.respostaAluno || '-';
    const row = [String(q.numero), resposta, q.gabarito, resultado, q.tema];
    
    // Cor do resultado
    if (q.acertou === true) doc.setTextColor(34, 197, 94);
    else if (q.acertou === false) doc.setTextColor(239, 68, 68);
    else doc.setTextColor(156, 163, 175);
    
    row.forEach((cell, i) => {
      if (i === 3) { /* resultado ja tem cor */ }
      else doc.setTextColor(0, 0, 0);
      
      doc.text(cell.substring(0, 25), xPos + 2, yPos + 5.5);
      xPos += colWidths[i];
    });
    
    doc.setTextColor(0, 0, 0);
    yPos += lineHeight;
  });
  
  // Salvar
  doc.save(`gabarito_${simuladoNome.replace(/\s+/g, '_')}.pdf`);
};
```

### Handler na Pagina

```typescript
const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

const handleDownloadGabarito = async () => {
  if (!selectedSimulado || !user) return;
  
  setIsDownloadingPDF(true);
  try {
    // Buscar dados das questoes e respostas
    const { data: answers, error } = await supabase
      .from('answer_progress')
      .select(`
        question_id,
        resposta_usuario,
        correct,
        questoes_simulado!inner (
          correta,
          tema
        )
      `)
      .eq('simulado', selectedSimulado)
      .eq('user_id', user.id);
    
    if (error) throw error;
    
    // Mapear para formato do PDF
    const questoes: GabaritoQuestao[] = (answers || []).map((a, index) => ({
      numero: index + 1,
      respostaAluno: a.resposta_usuario?.toUpperCase() || null,
      gabarito: (a.questoes_simulado as any)?.correta || '-',
      acertou: a.resposta_usuario ? a.correct : null,
      tema: (a.questoes_simulado as any)?.tema || '-',
    }));
    
    // Nome do simulado
    const simuladoInfo = simulados.find(s => s.id === selectedSimulado);
    const simuladoNome = simuladoInfo?.nome || 'Simulado';
    
    // Gerar PDF
    generateGabaritoPDF(simuladoNome, user.email || 'Aluno', questoes, {
      acertos: stats?.acertos || 0,
      total: stats?.total || 0,
      percentual: stats?.percentual || 0,
    });
    
    toast({ title: 'Gabarito gerado!', description: 'O PDF foi baixado com sucesso.' });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    toast({ title: 'Erro', description: 'Nao foi possivel gerar o gabarito.', variant: 'destructive' });
  } finally {
    setIsDownloadingPDF(false);
  }
};
```

### Consideracoes de UX

1. **Botao contextual**: So aparece habilitado quando um simulado especifico esta selecionado
2. **Loading state**: Icone de spinner durante geracao
3. **Feedback**: Toast confirmando download ou erro
4. **Nome do arquivo**: `gabarito_[nome_simulado].pdf` para facil identificacao

### Consideracoes de Performance

- PDF gerado no cliente (sem backend)
- Biblioteca jspdf e leve (~200KB gzipped)
- Dados buscados sob demanda (apenas ao clicar)
- Paginacao automatica para simulados longos

---

## Validacao

1. Selecionar um simulado especifico e clicar em "Baixar Gabarito"
2. Verificar que PDF contem cabecalho com nome do simulado
3. Confirmar que tabela mostra numero, resposta, gabarito, resultado e tema
4. Testar com simulado de muitas questoes (>30) para verificar paginacao
5. Verificar cores: verde para acertos, vermelho para erros, cinza para N/R
6. Confirmar que botao fica desabilitado na "Visao Geral"
7. Testar em dispositivos moveis (download funciona)
