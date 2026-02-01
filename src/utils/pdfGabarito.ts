import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header
  doc.setFillColor(79, 70, 229); // primary indigo
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('GABARITO', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(simuladoNome, pageWidth / 2, 28, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`, pageWidth / 2, 38, { align: 'center' });

  // Student info section
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(249, 250, 251);
  doc.rect(14, 52, pageWidth - 28, 20, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Aluno: ${alunoNome}`, 20, 64);
  
  doc.setFont('helvetica', 'bold');
  const resultText = `Resultado: ${stats.acertos}/${stats.total} (${stats.percentual}%)`;
  doc.text(resultText, pageWidth - 20, 64, { align: 'right' });

  // Table setup
  let yPos = 82;
  const lineHeight = 8;
  const colWidths = [18, 35, 35, 35, pageWidth - 28 - 18 - 35 - 35 - 35];
  const headers = ['#', 'Resposta', 'Gabarito', 'Resultado', 'Tema'];
  const colPositions = [14];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colPositions.push(colPositions[i] + colWidths[i]);
  }

  // Table header
  doc.setFillColor(79, 70, 229);
  doc.rect(14, yPos, pageWidth - 28, lineHeight + 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  headers.forEach((header, i) => {
    doc.text(header, colPositions[i] + 3, yPos + 6);
  });

  yPos += lineHeight + 2;
  doc.setFont('helvetica', 'normal');

  // Table rows
  questoes.forEach((q, index) => {
    // Check if need new page
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
      
      // Re-draw header on new page
      doc.setFillColor(79, 70, 229);
      doc.rect(14, yPos, pageWidth - 28, lineHeight + 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      headers.forEach((header, i) => {
        doc.text(header, colPositions[i] + 3, yPos + 6);
      });
      
      yPos += lineHeight + 2;
      doc.setFont('helvetica', 'normal');
    }

    // Alternating background
    if (index % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(14, yPos, pageWidth - 28, lineHeight, 'F');
    }

    const resultado = q.acertou === null ? 'N/R' : (q.acertou ? 'ACERTOU' : 'ERROU');
    const resposta = q.respostaAluno || '-';
    
    // Draw cells
    doc.setTextColor(60, 60, 60);
    doc.text(String(q.numero), colPositions[0] + 3, yPos + 5.5);
    doc.text(resposta.toUpperCase(), colPositions[1] + 3, yPos + 5.5);
    doc.text(q.gabarito.toUpperCase(), colPositions[2] + 3, yPos + 5.5);
    
    // Result with color
    if (q.acertou === true) {
      doc.setTextColor(34, 197, 94); // green
    } else if (q.acertou === false) {
      doc.setTextColor(239, 68, 68); // red
    } else {
      doc.setTextColor(156, 163, 175); // gray
    }
    doc.setFont('helvetica', 'bold');
    doc.text(resultado, colPositions[3] + 3, yPos + 5.5);
    
    // Reset for tema
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    
    // Truncate tema if too long
    const maxTemaWidth = colWidths[4] - 6;
    let tema = q.tema || '-';
    const temaWidth = doc.getStringUnitWidth(tema) * 9 / doc.internal.scaleFactor;
    if (temaWidth > maxTemaWidth) {
      while (doc.getStringUnitWidth(tema + '...') * 9 / doc.internal.scaleFactor > maxTemaWidth && tema.length > 0) {
        tema = tema.slice(0, -1);
      }
      tema += '...';
    }
    doc.text(tema, colPositions[4] + 3, yPos + 5.5);

    yPos += lineHeight;
  });

  // Footer with summary
  yPos += 10;
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, pageWidth - 14, yPos);
  yPos += 8;
  
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo:', 14, yPos);
  
  doc.setFont('helvetica', 'normal');
  yPos += 6;
  
  const acertos = questoes.filter(q => q.acertou === true).length;
  const erros = questoes.filter(q => q.acertou === false).length;
  const naoRespondidas = questoes.filter(q => q.acertou === null).length;
  
  doc.setTextColor(34, 197, 94);
  doc.text(`• Acertos: ${acertos}`, 14, yPos);
  
  doc.setTextColor(239, 68, 68);
  doc.text(`• Erros: ${erros}`, 60, yPos);
  
  doc.setTextColor(156, 163, 175);
  doc.text(`• Não respondidas: ${naoRespondidas}`, 100, yPos);

  // Save
  const safeFileName = simuladoNome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  
  doc.save(`gabarito_${safeFileName}.pdf`);
};
