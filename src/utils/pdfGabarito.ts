import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Logger } from '@/utils/logger';

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// COLOR PALETTE - SanarFlix Academy Brand
// ============================================================================

type RGB = [number, number, number];

const COLORS = {
  wine: {
    primary: [139, 21, 56] as RGB,
    dark: [107, 16, 40] as RGB,
    light: [169, 29, 70] as RGB,
  },
  blue: {
    primary: [25, 118, 210] as RGB,
    light: [66, 165, 245] as RGB,
  },
  success: {
    main: [5, 150, 105] as RGB,
    bg: [209, 250, 229] as RGB,
    text: [6, 95, 70] as RGB,
  },
  error: {
    main: [220, 38, 38] as RGB,
    bg: [254, 226, 226] as RGB,
    text: [153, 27, 27] as RGB,
  },
  neutral: {
    main: [107, 114, 128] as RGB,
    bg: [243, 244, 246] as RGB,
    bgLight: [249, 250, 251] as RGB,
    white: [255, 255, 255] as RGB,
    border: [229, 231, 235] as RGB,
  },
  text: {
    dark: [31, 41, 55] as RGB,
    muted: [107, 114, 128] as RGB,
    light: [156, 163, 175] as RGB,
  },
};

// ============================================================================
// LOGO
// ============================================================================

const LOGO_PATH = '/sanarflix-academy-symbol.png';
let cachedLogoBase64: string | null = null;

const loadLogoAsBase64 = async (): Promise<string | null> => {
  if (cachedLogoBase64) return cachedLogoBase64;
  
  try {
    const response = await fetch(LOGO_PATH);
    if (!response.ok) throw new Error('Failed to fetch logo');
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoBase64 = reader.result as string;
        resolve(cachedLogoBase64);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    Logger.error('Error loading logo:', error);
    return null;
  }
};

const drawFallbackLogo = (doc: jsPDF): void => {
  doc.setTextColor(...COLORS.wine.primary);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('S', 17, 21);
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const drawRoundedRect = (
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  style: 'F' | 'S' | 'FD' = 'F'
): void => {
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  doc.roundedRect(x, y, w, h, r, r, style);
};

const drawGradientHeader = (doc: jsPDF, height: number): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const steps = 40; // Smoother gradient (was 20)
  const stepHeight = height / steps;
  
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const r = Math.round(COLORS.wine.primary[0] * (1 - ratio) + COLORS.wine.dark[0] * ratio);
    const g = Math.round(COLORS.wine.primary[1] * (1 - ratio) + COLORS.wine.dark[1] * ratio);
    const b = Math.round(COLORS.wine.primary[2] * (1 - ratio) + COLORS.wine.dark[2] * ratio);
    
    doc.setFillColor(r, g, b);
    doc.rect(0, i * stepHeight, pageWidth, stepHeight + 0.5, 'F');
  }
};

const drawProgressBar = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  percentage: number,
  fillColor: RGB,
  bgColor: RGB = COLORS.neutral.border
): void => {
  doc.setFillColor(...bgColor);
  drawRoundedRect(doc, x, y, width, height, height / 2, 'F');
  
  if (percentage > 0) {
    const filledWidth = Math.max((width * percentage) / 100, height);
    doc.setFillColor(...fillColor);
    drawRoundedRect(doc, x, y, filledWidth, height, height / 2, 'F');
  }
};

const getPercentageColor = (percentage: number): RGB => {
  if (percentage >= 70) return COLORS.success.main;
  if (percentage >= 50) return [234, 179, 8] as RGB;
  return COLORS.error.main;
};

const drawCheckIcon = (doc: jsPDF, x: number, y: number, size: number, color: RGB): void => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.6);
  const startX = x + size * 0.2;
  const startY = y + size * 0.5;
  const midX = x + size * 0.45;
  const midY = y + size * 0.75;
  const endX = x + size * 0.85;
  const endY = y + size * 0.25;
  
  doc.line(startX, startY, midX, midY);
  doc.line(midX, midY, endX, endY);
};

const drawXIcon = (doc: jsPDF, x: number, y: number, size: number, color: RGB): void => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.6);
  const padding = size * 0.25;
  doc.line(x + padding, y + padding, x + size - padding, y + size - padding);
  doc.line(x + size - padding, y + padding, x + padding, y + size - padding);
};

const drawCircleIcon = (doc: jsPDF, x: number, y: number, size: number, color: RGB): void => {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.5);
  doc.circle(x + size / 2, y + size / 2, size * 0.3, 'S');
};

const truncateText = (doc: jsPDF, text: string, maxWidth: number, fontSize: number): string => {
  let truncated = text;
  const ellipsis = '...';
  
  while (doc.getStringUnitWidth(truncated) * fontSize / doc.internal.scaleFactor > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  
  if (truncated.length < text.length) {
    truncated = truncated.slice(0, -3) + ellipsis;
  }
  
  return truncated;
};

// ============================================================================
// SECTION DRAWING FUNCTIONS
// ============================================================================

const drawPremiumHeader = (doc: jsPDF, simuladoNome: string, logoBase64: string | null): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const headerHeight = 55;
  
  drawGradientHeader(doc, headerHeight);
  
  doc.setFillColor(...COLORS.neutral.white);
  doc.circle(21, 17, 10, 'F');
  
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 11, 7, 20, 20);
    } catch {
      drawFallbackLogo(doc);
    }
  } else {
    drawFallbackLogo(doc);
  }
  
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SanarFlix Academy', 36, 19);
  
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateText = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(dateText, pageWidth - 14, 17, { align: 'right' });
  
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('GABARITO COMPLETO', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const truncatedSimulado = truncateText(doc, simuladoNome, pageWidth - 40, 11);
  doc.text(truncatedSimulado, pageWidth / 2, 50, { align: 'center' });
  
  return headerHeight + 8;
};

const drawIdentificationCard = (
  doc: jsPDF,
  alunoNome: string,
  stats: GabaritoStats,
  yStart: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cardWidth = pageWidth - 28;
  const cardHeight = 32;
  const cardX = 14;
  
  doc.setFillColor(...COLORS.neutral.bgLight);
  doc.setDrawColor(...COLORS.neutral.border);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, cardX, yStart, cardWidth, cardHeight, 4, 'FD');
  
  // Left section - Student info
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ALUNO', cardX + 8, yStart + 10);
  
  doc.setTextColor(...COLORS.text.dark);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const truncatedName = truncateText(doc, alunoNome, cardWidth / 2 - 20, 12);
  doc.text(truncatedName, cardX + 8, yStart + 20);
  
  // Right section - Results
  const rightX = cardX + cardWidth / 2 + 10;
  
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADO', rightX, yStart + 10);
  
  const percentColor = getPercentageColor(stats.percentual);
  doc.setTextColor(...percentColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`${stats.acertos}/${stats.total}`, rightX, yStart + 20);
  
  doc.setFontSize(10);
  doc.text(`${stats.percentual}%`, rightX + 35, yStart + 20);
  
  // Progress bar - safe width calculation
  const cardRightEdge = cardX + cardWidth - 8;
  const barX = rightX + 55;
  const barWidth = Math.min(40, cardRightEdge - barX);
  const barY = yStart + 15;
  
  if (barWidth > 10) {
    drawProgressBar(doc, barX, barY, barWidth, 6, stats.percentual, percentColor);
  }
  
  return yStart + cardHeight + 10;
};

const drawQuestionsTable = (
  doc: jsPDF,
  questoes: GabaritoQuestao[],
  yStart: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const tableWidth = pageWidth - (marginX * 2);
  
  const colWidths = {
    numero: 16,
    resposta: 28,
    gabarito: 28,
    resultado: 42, // Was 40 - wider for badges
    tema: tableWidth - 16 - 28 - 28 - 42,
  };
  
  const headers = ['#', 'SUA RESP.', 'GABARITO', 'RESULTADO', 'TEMA'];
  const lineHeight = 10; // Was 9 - taller rows
  const headerHeight = 11; // Was 10
  
  let yPos = yStart;
  let isFirstPage = true;
  
  const drawTableHeader = (y: number): number => {
    doc.setFillColor(...COLORS.wine.primary);
    drawRoundedRect(doc, marginX, y, tableWidth, headerHeight, isFirstPage ? 3 : 0, 'F');
    
    doc.setTextColor(...COLORS.neutral.white);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    
    // Vertically center header text
    const headerTextY = y + headerHeight / 2 + 8 * 0.35 * 0.7;
    
    let xPos = marginX + 4;
    doc.text(headers[0], xPos + colWidths.numero / 2, headerTextY, { align: 'center' });
    xPos += colWidths.numero;
    doc.text(headers[1], xPos + colWidths.resposta / 2, headerTextY, { align: 'center' });
    xPos += colWidths.resposta;
    doc.text(headers[2], xPos + colWidths.gabarito / 2, headerTextY, { align: 'center' });
    xPos += colWidths.gabarito;
    doc.text(headers[3], xPos + colWidths.resultado / 2, headerTextY, { align: 'center' });
    xPos += colWidths.resultado;
    doc.text(headers[4], xPos + 4, headerTextY);
    
    return y + headerHeight;
  };
  
  yPos = drawTableHeader(yPos);
  
  questoes.forEach((q, index) => {
    if (yPos > pageHeight - 40) {
      addPageFooter(doc);
      doc.addPage();
      isFirstPage = false;
      yPos = 20;
      yPos = drawTableHeader(yPos);
    }
    
    const bgColor = index % 2 === 0 ? COLORS.neutral.white : COLORS.neutral.bgLight;
    doc.setFillColor(...bgColor);
    doc.rect(marginX, yPos, tableWidth, lineHeight, 'F');
    
    // Vertically center all row content
    const rowCenterY = yPos + lineHeight / 2;
    const textVerticalOffset = 9 * 0.35 * 0.7; // Font metric centering
    const rowTextY = rowCenterY + textVerticalOffset;
    
    let xPos = marginX + 4;
    
    // Number
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(String(q.numero), xPos + colWidths.numero / 2, rowTextY, { align: 'center' });
    xPos += colWidths.numero;
    
    // Student answer
    const resposta = q.respostaAluno || '-';
    doc.setFont('helvetica', 'normal');
    doc.text(resposta.toUpperCase(), xPos + colWidths.resposta / 2, rowTextY, { align: 'center' });
    xPos += colWidths.resposta;
    
    // Correct answer
    doc.setFont('helvetica', 'bold');
    doc.text(q.gabarito.toUpperCase(), xPos + colWidths.gabarito / 2, rowTextY, { align: 'center' });
    xPos += colWidths.gabarito;
    
    // Result badge - centered in cell
    const badgeWidth = 38; // Was 36
    const badgeHeight = 7; // Was 6
    const badgeX = xPos + (colWidths.resultado - badgeWidth) / 2;
    const badgeY = rowCenterY - badgeHeight / 2;
    
    if (q.acertou === true) {
      doc.setFillColor(...COLORS.success.bg);
      drawRoundedRect(doc, badgeX, badgeY, badgeWidth, badgeHeight, 2, 'F');
      drawCheckIcon(doc, badgeX + 2, badgeY, badgeHeight, COLORS.success.main);
      doc.setTextColor(...COLORS.success.text);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const badgeTextY = rowCenterY + 7 * 0.35 * 0.7;
      doc.text('ACERTOU', badgeX + badgeWidth / 2 + 2, badgeTextY, { align: 'center' });
    } else if (q.acertou === false) {
      doc.setFillColor(...COLORS.error.bg);
      drawRoundedRect(doc, badgeX, badgeY, badgeWidth, badgeHeight, 2, 'F');
      drawXIcon(doc, badgeX + 2, badgeY, badgeHeight, COLORS.error.main);
      doc.setTextColor(...COLORS.error.text);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const badgeTextY = rowCenterY + 7 * 0.35 * 0.7;
      doc.text('ERROU', badgeX + badgeWidth / 2 + 2, badgeTextY, { align: 'center' });
    } else {
      doc.setFillColor(...COLORS.neutral.bg);
      drawRoundedRect(doc, badgeX, badgeY, badgeWidth, badgeHeight, 2, 'F');
      drawCircleIcon(doc, badgeX + 2, badgeY, badgeHeight, COLORS.neutral.main);
      doc.setTextColor(...COLORS.text.muted);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const badgeTextY = rowCenterY + 7 * 0.35 * 0.7;
      doc.text('N/RESP', badgeX + badgeWidth / 2 + 2, badgeTextY, { align: 'center' });
    }
    xPos += colWidths.resultado;
    
    // Tema
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const tema = q.tema || '-';
    const truncatedTema = truncateText(doc, tema, colWidths.tema - 10, 8);
    doc.text(truncatedTema, xPos + 4, rowTextY);
    
    yPos += lineHeight;
  });
  
  // Bottom border
  doc.setDrawColor(...COLORS.neutral.border);
  doc.setLineWidth(0.3);
  doc.line(marginX, yPos, marginX + tableWidth, yPos);
  
  return yPos + 10;
};

const drawSummarySection = (
  doc: jsPDF,
  questoes: GabaritoQuestao[],
  stats: GabaritoStats,
  yStart: number
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  if (yStart > pageHeight - 60) {
    addPageFooter(doc);
    doc.addPage();
    yStart = 20;
  }
  
  const marginX = 14;
  const sectionWidth = pageWidth - (marginX * 2);
  
  doc.setFillColor(...COLORS.wine.primary);
  drawRoundedRect(doc, marginX, yStart, sectionWidth, 10, 3, 'F');
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DO DESEMPENHO', pageWidth / 2, yStart + 7, { align: 'center' });
  
  let yPos = yStart + 18;
  
  const acertos = questoes.filter(q => q.acertou === true).length;
  const erros = questoes.filter(q => q.acertou === false).length;
  const naoRespondidas = questoes.filter(q => q.acertou === null).length;
  
  const cardWidth = (sectionWidth - 16) / 3;
  const cardHeight = 28;
  const gap = 8;
  
  // Card 1 - Acertos
  const card1X = marginX;
  doc.setFillColor(...COLORS.success.bg);
  drawRoundedRect(doc, card1X, yPos, cardWidth, cardHeight, 4, 'F');
  doc.setTextColor(...COLORS.success.main);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(String(acertos), card1X + cardWidth / 2, yPos + 14, { align: 'center' });
  doc.setFontSize(8);
  doc.text('ACERTOS', card1X + cardWidth / 2, yPos + 22, { align: 'center' });
  
  // Card 2 - Erros
  const card2X = marginX + cardWidth + gap;
  doc.setFillColor(...COLORS.error.bg);
  drawRoundedRect(doc, card2X, yPos, cardWidth, cardHeight, 4, 'F');
  doc.setTextColor(...COLORS.error.main);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(String(erros), card2X + cardWidth / 2, yPos + 14, { align: 'center' });
  doc.setFontSize(8);
  doc.text('ERROS', card2X + cardWidth / 2, yPos + 22, { align: 'center' });
  
  // Card 3 - Não respondidas
  const card3X = marginX + (cardWidth + gap) * 2;
  doc.setFillColor(...COLORS.neutral.bg);
  drawRoundedRect(doc, card3X, yPos, cardWidth, cardHeight, 4, 'F');
  doc.setTextColor(...COLORS.neutral.main);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(String(naoRespondidas), card3X + cardWidth / 2, yPos + 14, { align: 'center' });
  doc.setFontSize(8);
  doc.text('NÃO RESPONDIDAS', card3X + cardWidth / 2, yPos + 22, { align: 'center' });
  
  yPos += cardHeight + 12;
  
  // Performance by theme
  const themeStats = calculateThemeStats(questoes);
  
  if (themeStats.length > 0 && yPos < pageHeight - 60) {
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('DESEMPENHO POR ÁREA', marginX, yPos + 4);
    
    yPos += 10;
    
    const maxThemes = Math.min(themeStats.length, 5);
    const barMaxWidth = sectionWidth - 80;
    
    for (let i = 0; i < maxThemes; i++) {
      const theme = themeStats[i];
      const percentage = theme.total > 0 ? Math.round((theme.acertos / theme.total) * 100) : 0;
      const barColor = getPercentageColor(percentage);
      
      doc.setTextColor(...COLORS.text.dark);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const truncatedTheme = truncateText(doc, theme.tema, 50, 8);
      doc.text(truncatedTheme, marginX, yPos + 4);
      
      drawProgressBar(doc, marginX + 55, yPos, barMaxWidth, 5, percentage, barColor);
      
      doc.setTextColor(...barColor);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`${percentage}%`, marginX + 55 + barMaxWidth + 5, yPos + 4);
      
      yPos += 10;
    }
  }
  
  return yPos;
};

const calculateThemeStats = (questoes: GabaritoQuestao[]): { tema: string; acertos: number; total: number }[] => {
  const themeMap = new Map<string, { acertos: number; total: number }>();
  
  questoes.forEach(q => {
    const tema = q.tema || 'Outros';
    const existing = themeMap.get(tema) || { acertos: 0, total: 0 };
    existing.total++;
    if (q.acertou === true) existing.acertos++;
    themeMap.set(tema, existing);
  });
  
  return Array.from(themeMap.entries())
    .map(([tema, stats]) => ({ tema, ...stats }))
    .sort((a, b) => b.total - a.total);
};

const addPageFooter = (doc: jsPDF): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 12;
  
  doc.setDrawColor(...COLORS.neutral.border);
  doc.setLineWidth(0.3);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);
  
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Gerado por SanarFlix Academy', 14, footerY);
  doc.text('academy.sanar.com.br', pageWidth / 2, footerY, { align: 'center' });
  
  const pageCount = doc.getNumberOfPages();
  const currentPage = doc.getCurrentPageInfo().pageNumber;
  doc.text(`Página ${currentPage} de ${pageCount}`, pageWidth - 14, footerY, { align: 'right' });
};

const addFooterToAllPages = (doc: jsPDF): void => {
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    addPageFooter(doc);
  }
};

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export const generateGabaritoPDF = async (
  simuladoNome: string,
  alunoNome: string,
  questoes: GabaritoQuestao[],
  stats: GabaritoStats
): Promise<void> => {
  const doc = new jsPDF();
  
  const logoBase64 = await loadLogoAsBase64();
  
  let yPos = drawPremiumHeader(doc, simuladoNome, logoBase64);
  yPos = drawIdentificationCard(doc, alunoNome, stats, yPos);
  yPos = drawQuestionsTable(doc, questoes, yPos);
  drawSummarySection(doc, questoes, stats, yPos);
  addFooterToAllPages(doc);
  
  const safeFileName = simuladoNome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  
  doc.save(`gabarito_${safeFileName}.pdf`);
};
