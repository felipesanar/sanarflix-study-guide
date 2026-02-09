import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================================
// TYPES
// ============================================================================

export interface AlternativaRevisada {
  letra: 'A' | 'B' | 'C' | 'D' | 'E';
  texto: string;
  isCorreta: boolean;
  isMarcadaPeloAluno: boolean;
}

export interface QuestaoRevisada {
  numero: number;
  enunciado: string;
  alternativas: AlternativaRevisada[];
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

export interface ProvaRevisadaStats {
  acertos: number;
  erros: number;
  naoRespondidas: number;
  total: number;
  percentual: number;
  porArea: { area: string; acertos: number; total: number; percentual: number }[];
  porDificuldade: { nivel: string; acertos: number; total: number; percentual: number }[];
}

export interface OnProgressCallback {
  (stage: 'preparing' | 'loading_questions' | 'loading_images' | 'generating' | 'complete', current?: number, total?: number): void;
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
  warning: {
    main: [217, 119, 6] as RGB,
    bg: [254, 243, 199] as RGB,
    text: [146, 64, 14] as RGB,
  },
  purple: {
    main: [139, 92, 246] as RGB,
    bg: [237, 233, 254] as RGB,
    text: [91, 33, 182] as RGB,
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
// LOGO HANDLING
// ============================================================================

const LOGO_PATH = '/lovable-uploads/8b68f9f7-c5f4-42f8-9ac8-0bffc3fdb96d.png';
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
  } catch {
    return null;
  }
};

/**
 * Load question image as base64 with timeout
 */
const loadImageAsBase64 = async (url: string, timeoutMs = 5000): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ============================================================================
// TEXT SANITIZATION
// ============================================================================

/**
 * Sanitize text to remove problematic characters for PDF rendering
 * - Removes control characters
 * - Normalizes Unicode
 * - Replaces special characters with ASCII equivalents
 */
const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  return text
    // Normalize Unicode to compatible form
    .normalize('NFKC')
    // Remove control characters except space
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Replace tabs and line breaks with space
    .replace(/[\t\n\r]/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Replace smart quotes with regular quotes
    .replace(/[''‚]/g, "'")
    .replace(/[""„]/g, '"')
    // Replace dashes
    .replace(/[–—−]/g, '-')
    // Replace ellipsis
    .replace(/…/g, '...')
    // Replace degree symbol
    .replace(/°/g, 'o')
    // Replace superscripts
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    // Replace micro symbol
    .replace(/µ/g, 'u')
    // Replace bullet
    .replace(/•/g, '-')
    // Replace trademark symbols
    .replace(/[™®©]/g, '')
    // Replace non-breaking space
    .replace(/\u00A0/g, ' ')
    // Remove other non-printable characters but keep extended latin
    .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F]/g, ' ')
    // Normalize spaces again after replacements
    .replace(/\s+/g, ' ')
    .trim();
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
  const steps = 20;
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
  if (percentage >= 50) return COLORS.warning.main;
  return COLORS.error.main;
};

const truncateText = (doc: jsPDF, text: string, maxWidth: number, fontSize: number): string => {
  const sanitized = sanitizeText(text);
  let truncated = sanitized;
  const ellipsis = '...';
  
  while (doc.getStringUnitWidth(truncated) * fontSize / doc.internal.scaleFactor > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  
  if (truncated.length < sanitized.length) {
    truncated = truncated.slice(0, -3) + ellipsis;
  }
  
  return truncated;
};

/**
 * Robust text wrapping with sanitization and word-break for long words
 */
const wrapText = (doc: jsPDF, text: string, maxWidth: number): string[] => {
  const sanitized = sanitizeText(text);
  if (!sanitized) return [];
  
  const words = sanitized.split(' ').filter(w => w.length > 0);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    // Check if word alone exceeds maxWidth - break it if necessary
    if (doc.getTextWidth(word) > maxWidth) {
      // Finalize current line if exists
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      
      // Break long word into chunks
      let remaining = word;
      while (remaining.length > 0) {
        let chunk = '';
        for (let i = 1; i <= remaining.length; i++) {
          const test = remaining.substring(0, i);
          if (doc.getTextWidth(test) > maxWidth - 3) {
            chunk = remaining.substring(0, Math.max(1, i - 1));
            break;
          }
          chunk = test;
        }
        if (chunk.length === remaining.length) {
          lines.push(chunk);
          break;
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

// ============================================================================
// COVER PAGE
// ============================================================================

const drawCoverPage = (
  doc: jsPDF,
  simuladoNome: string,
  alunoNome: string,
  stats: ProvaRevisadaStats,
  logoBase64: string | null
): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header gradient
  drawGradientHeader(doc, 60);
  
  // Logo
  if (logoBase64) {
    doc.setFillColor(...COLORS.neutral.white);
    doc.circle(21, 17, 10, 'F');
    try {
      doc.addImage(logoBase64, 'PNG', 11, 7, 20, 20);
    } catch {
      doc.setTextColor(...COLORS.wine.primary);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('S', 17, 21);
    }
  }
  
  // Brand name
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SanarFlix Academy', 36, 19);
  
  // Date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateText = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  doc.text(dateText, pageWidth - 14, 17, { align: 'right' });
  
  // Main title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PROVA REVISADA COMPLETA', pageWidth / 2, 42, { align: 'center' });
  
  // Simulado name
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const truncatedSimulado = truncateText(doc, simuladoNome, pageWidth - 40, 12);
  doc.text(truncatedSimulado, pageWidth / 2, 52, { align: 'center' });
  
  // Student info card
  const cardY = 70;
  const cardHeight = 30;
  doc.setFillColor(...COLORS.neutral.bgLight);
  doc.setDrawColor(...COLORS.neutral.border);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, 14, cardY, pageWidth - 28, cardHeight, 4, 'FD');
  
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('ALUNO', 22, cardY + 12);
  
  doc.setTextColor(...COLORS.text.dark);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(alunoNome, 22, cardY + 22);
  
  // Stats cards
  const statsY = 115;
  const cardWidth = (pageWidth - 56) / 3;
  const statsCardHeight = 50;
  
  // Acertos card
  doc.setFillColor(...COLORS.success.bg);
  drawRoundedRect(doc, 14, statsY, cardWidth, statsCardHeight, 6, 'F');
  doc.setTextColor(...COLORS.success.main);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(String(stats.acertos), 14 + cardWidth / 2, statsY + 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text('ACERTOS', 14 + cardWidth / 2, statsY + 35, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const acertosPerc = stats.total > 0 ? Math.round((stats.acertos / stats.total) * 100) : 0;
  doc.text(`${acertosPerc}%`, 14 + cardWidth / 2, statsY + 44, { align: 'center' });
  
  // Erros card
  const card2X = 14 + cardWidth + 14;
  doc.setFillColor(...COLORS.error.bg);
  drawRoundedRect(doc, card2X, statsY, cardWidth, statsCardHeight, 6, 'F');
  doc.setTextColor(...COLORS.error.main);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(String(stats.erros), card2X + cardWidth / 2, statsY + 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text('ERROS', card2X + cardWidth / 2, statsY + 35, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const errosPerc = stats.total > 0 ? Math.round((stats.erros / stats.total) * 100) : 0;
  doc.text(`${errosPerc}%`, card2X + cardWidth / 2, statsY + 44, { align: 'center' });
  
  // Não respondidas card
  const card3X = card2X + cardWidth + 14;
  doc.setFillColor(...COLORS.neutral.bg);
  drawRoundedRect(doc, card3X, statsY, cardWidth, statsCardHeight, 6, 'F');
  doc.setTextColor(...COLORS.neutral.main);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(String(stats.naoRespondidas), card3X + cardWidth / 2, statsY + 22, { align: 'center' });
  doc.setFontSize(10);
  doc.text('N/RESPONDIDAS', card3X + cardWidth / 2, statsY + 35, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const nrPerc = stats.total > 0 ? Math.round((stats.naoRespondidas / stats.total) * 100) : 0;
  doc.text(`${nrPerc}%`, card3X + cardWidth / 2, statsY + 44, { align: 'center' });
  
  // Performance by area section
  if (stats.porArea.length > 0) {
    const sectionY = 180;
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DESEMPENHO POR ÁREA', 14, sectionY);
    
    let areaY = sectionY + 12;
    const barMaxWidth = pageWidth - 100;
    
    const sortedAreas = [...stats.porArea].sort((a, b) => b.percentual - a.percentual);
    const maxAreas = Math.min(sortedAreas.length, 8);
    
    for (let i = 0; i < maxAreas; i++) {
      const area = sortedAreas[i];
      const barColor = getPercentageColor(area.percentual);
      
      // Area name
      doc.setTextColor(...COLORS.text.dark);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const truncatedArea = truncateText(doc, area.area, 60, 9);
      doc.text(truncatedArea, 14, areaY + 4);
      
      // Progress bar
      drawProgressBar(doc, 75, areaY, barMaxWidth, 5, area.percentual, barColor);
      
      // Percentage
      doc.setTextColor(...barColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${area.percentual}%`, 75 + barMaxWidth + 5, areaY + 4);
      
      areaY += 12;
    }
  }
  
  // Footer
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado por SanarFlix Academy', 14, pageHeight - 12);
  doc.text('Página 1', pageWidth - 14, pageHeight - 12, { align: 'right' });
};

// ============================================================================
// QUESTION RENDERING
// ============================================================================

const drawStatusBadge = (
  doc: jsPDF,
  x: number,
  y: number,
  status: 'acertou' | 'errou' | 'nao_respondeu' | 'anulada'
): void => {
  const badgeWidth = 28;
  const badgeHeight = 7;
  
  const config = {
    acertou: { bg: COLORS.success.bg, text: COLORS.success.text, label: 'ACERTOU' },
    errou: { bg: COLORS.error.bg, text: COLORS.error.text, label: 'ERROU' },
    nao_respondeu: { bg: COLORS.warning.bg, text: COLORS.warning.text, label: 'N/RESP' },
    anulada: { bg: COLORS.purple.bg, text: COLORS.purple.text, label: 'ANULADA' },
  };
  
  const c = config[status];
  doc.setFillColor(...c.bg);
  drawRoundedRect(doc, x, y, badgeWidth, badgeHeight, 2, 'F');
  doc.setTextColor(...c.text);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(c.label, x + badgeWidth / 2, y + 5, { align: 'center' });
};

const drawAlternative = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  alt: AlternativaRevisada,
  questaoAnulada: boolean
): number => {
  const lineHeight = 5.5;
  const padding = 5;
  const letterWidth = 14;
  
  // Determine style
  let bgColor: RGB = COLORS.neutral.white;
  let borderColor: RGB = COLORS.neutral.border;
  let textColor: RGB = COLORS.text.dark;
  let labelText = '';
  let labelColor: RGB = COLORS.success.text;
  
  if (questaoAnulada) {
    // All alternatives neutral when question is annulled
    bgColor = COLORS.neutral.bgLight;
    if (alt.isCorreta) {
      labelText = '(era a correta)';
    }
  } else if (alt.isCorreta && alt.isMarcadaPeloAluno) {
    // Correct and student marked it
    bgColor = COLORS.success.bg;
    borderColor = COLORS.success.main;
    labelText = 'CORRETA - SUA RESPOSTA';
    labelColor = COLORS.success.text;
  } else if (alt.isCorreta && !alt.isMarcadaPeloAluno) {
    // Correct but student didn't mark
    bgColor = [220, 252, 231] as RGB; // Lighter green
    borderColor = COLORS.success.main;
    labelText = 'CORRETA';
    labelColor = COLORS.success.text;
  } else if (!alt.isCorreta && alt.isMarcadaPeloAluno) {
    // Wrong and student marked it
    bgColor = COLORS.error.bg;
    borderColor = COLORS.error.main;
    textColor = COLORS.error.text;
    labelText = 'SUA RESPOSTA';
    labelColor = COLORS.error.text;
  }
  
  // Calculate label width if present
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const labelWidth = labelText ? doc.getTextWidth(labelText) + 8 : 0;
  
  // Calculate available text width (reserve space for label on first line)
  const textMaxWidth = width - padding * 2 - letterWidth - (labelText ? labelWidth + 5 : 0);
  
  // Sanitize and wrap text
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const sanitizedTexto = sanitizeText(alt.texto);
  const wrappedLines = wrapText(doc, sanitizedTexto, textMaxWidth);
  
  // Calculate block height
  const textHeight = Math.max(wrappedLines.length, 1) * lineHeight;
  const blockHeight = Math.max(textHeight + padding * 2, 16);
  
  // Draw background
  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(0.3);
  drawRoundedRect(doc, x, y, width, blockHeight, 3, 'FD');
  
  // Draw letter circle/badge
  const letterCenterX = x + padding + 5;
  const letterCenterY = y + padding + 5;
  doc.setFillColor(...COLORS.wine.primary);
  doc.circle(letterCenterX, letterCenterY, 5, 'F');
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(alt.letra, letterCenterX, letterCenterY + 3, { align: 'center' });
  
  // Draw text lines
  doc.setTextColor(...textColor);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  wrappedLines.forEach((line, idx) => {
    doc.text(line, x + padding + letterWidth, y + padding + 5 + idx * lineHeight);
  });
  
  // Draw label badge if present (positioned at top right, separate from text)
  if (labelText) {
    const labelBadgeX = x + width - padding - labelWidth;
    const labelBadgeY = y + padding;
    const labelBadgeHeight = 6;
    
    // Draw label background
    doc.setFillColor(...(alt.isMarcadaPeloAluno && !alt.isCorreta ? COLORS.error.bg : COLORS.success.bg));
    drawRoundedRect(doc, labelBadgeX, labelBadgeY, labelWidth, labelBadgeHeight, 2, 'F');
    
    // Draw label text
    doc.setTextColor(...labelColor);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(labelText, labelBadgeX + labelWidth / 2, labelBadgeY + 4.5, { align: 'center' });
  }
  
  return blockHeight + 4;
};

const drawQuestionBlock = (
  doc: jsPDF,
  questao: QuestaoRevisada,
  yStart: number,
  imageBase64: string | null
): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  
  let yPos = yStart;
  
  // Check if we need new page (minimum 100px for question header)
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = 20;
  }
  
  // Question header bar
  doc.setFillColor(...COLORS.wine.primary);
  drawRoundedRect(doc, marginX, yPos, contentWidth, 12, 3, 'F');
  
  // Question number
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`QUESTÃO ${questao.numero}`, marginX + 6, yPos + 8);
  
  // Difficulty and area
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const metaText = `${questao.dificuldade || 'Médio'} • ${questao.grandeArea || 'Geral'}`;
  doc.text(metaText, pageWidth / 2, yPos + 8, { align: 'center' });
  
  // Status badge
  let status: 'acertou' | 'errou' | 'nao_respondeu' | 'anulada' = 'nao_respondeu';
  if (questao.anulada) {
    status = 'anulada';
  } else if (questao.acertou === true) {
    status = 'acertou';
  } else if (questao.acertou === false) {
    status = 'errou';
  }
  drawStatusBadge(doc, pageWidth - marginX - 30, yPos + 2.5, status);
  
  yPos += 18;
  
  // Enunciado - sanitized
  doc.setTextColor(...COLORS.text.dark);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const sanitizedEnunciado = sanitizeText(questao.enunciado);
  const enunciadoLines = wrapText(doc, sanitizedEnunciado, contentWidth - 10);
  
  enunciadoLines.forEach(line => {
    if (yPos > pageHeight - 30) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, marginX + 5, yPos);
    yPos += 5.5;
  });
  
  yPos += 6;
  
  // Image if present
  if (imageBase64) {
    try {
      const imgWidth = Math.min(contentWidth - 20, 120);
      const imgHeight = 60;
      
      if (yPos + imgHeight > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.addImage(imageBase64, 'PNG', marginX + 10, yPos, imgWidth, imgHeight);
      yPos += imgHeight + 8;
    } catch {
      // Skip if image fails
    }
  }
  
  // Alternativas
  yPos += 3;
  for (const alt of questao.alternativas) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = 20;
    }
    const altHeight = drawAlternative(doc, marginX, yPos, contentWidth, alt, questao.anulada);
    yPos += altHeight;
  }
  
  // Comentário do professor - with proper sanitization and spacing
  if (questao.comentario) {
    yPos += 8;
    
    // Sanitize and wrap comment text with larger internal margin
    const sanitizedComment = sanitizeText(questao.comentario);
    const commentMaxWidth = contentWidth - 24; // Larger internal margin
    
    doc.setFontSize(9);
    const commentLines = wrapText(doc, sanitizedComment, commentMaxWidth);
    
    // Calculate height with proper padding
    const headerHeight = 14;
    const textPadding = 10;
    const lineSpacing = 5.5;
    const commentTextHeight = commentLines.length * lineSpacing;
    const commentHeight = headerHeight + commentTextHeight + textPadding;
    
    // Check if we need new page for comment
    if (yPos + commentHeight > pageHeight - 25) {
      doc.addPage();
      yPos = 20;
    }
    
    // Comment box
    doc.setFillColor(...COLORS.neutral.bgLight);
    doc.setDrawColor(...COLORS.wine.primary);
    doc.setLineWidth(0.5);
    drawRoundedRect(doc, marginX, yPos, contentWidth, commentHeight, 4, 'FD');
    
    // Comment header
    doc.setTextColor(...COLORS.wine.primary);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('COMENTÁRIO DO PROFESSOR', marginX + 10, yPos + 10);
    
    // Comment text with proper line spacing
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    let commentY = yPos + headerHeight + 4;
    commentLines.forEach(line => {
      doc.text(line, marginX + 12, commentY);
      commentY += lineSpacing;
    });
    
    yPos += commentHeight + 8;
  }
  
  // Separator
  yPos += 8;
  doc.setDrawColor(...COLORS.neutral.border);
  doc.setLineWidth(0.2);
  doc.line(marginX + 20, yPos, pageWidth - marginX - 20, yPos);
  yPos += 8;
  
  return yPos;
};

// ============================================================================
// ANALYSIS PAGE
// ============================================================================

const drawAnalysisPage = (
  doc: jsPDF,
  stats: ProvaRevisadaStats
): void => {
  doc.addPage();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  
  // Header
  doc.setFillColor(...COLORS.wine.primary);
  drawRoundedRect(doc, marginX, 15, pageWidth - marginX * 2, 15, 4, 'F');
  doc.setTextColor(...COLORS.neutral.white);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ANÁLISE DE DESEMPENHO', pageWidth / 2, 26, { align: 'center' });
  
  let yPos = 45;
  
  // Sort areas by performance
  const sortedAreas = [...stats.porArea].sort((a, b) => b.percentual - a.percentual);
  const bestArea = sortedAreas[0];
  const worstArea = sortedAreas[sortedAreas.length - 1];
  
  // Pontos Fortes section
  if (bestArea) {
    doc.setTextColor(...COLORS.success.main);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('★ PONTOS FORTES', marginX, yPos);
    yPos += 10;
    
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const forteText = `Sua principal fortaleza foi em ${bestArea.area}, com ${bestArea.percentual}% de acertos (${bestArea.acertos}/${bestArea.total} questões). Continue fortalecendo esta área e use-a como base para outras.`;
    const forteLines = wrapText(doc, forteText, pageWidth - marginX * 2 - 10);
    forteLines.forEach(line => {
      doc.text(line, marginX + 5, yPos);
      yPos += 5;
    });
    yPos += 10;
  }
  
  // Oportunidades de Melhoria section
  if (worstArea && sortedAreas.length > 1) {
    doc.setTextColor(...COLORS.error.main);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('↑ OPORTUNIDADES DE MELHORIA', marginX, yPos);
    yPos += 10;
    
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const melhoriaText = `A área com maior oportunidade de crescimento é ${worstArea.area}, com ${worstArea.percentual}% de acertos (${worstArea.acertos}/${worstArea.total} questões). Foque nos temas mais desafiadores desta área.`;
    const melhoriaLines = wrapText(doc, melhoriaText, pageWidth - marginX * 2 - 10);
    melhoriaLines.forEach(line => {
      doc.text(line, marginX + 5, yPos);
      yPos += 5;
    });
    yPos += 15;
  }
  
  // Performance by difficulty
  if (stats.porDificuldade.length > 0) {
    doc.setTextColor(...COLORS.text.dark);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ANÁLISE POR DIFICULDADE', marginX, yPos);
    yPos += 12;
    
    const barWidth = pageWidth - marginX * 2 - 80;
    
    stats.porDificuldade.forEach(diff => {
      const barColor = getPercentageColor(diff.percentual);
      
      // Difficulty name
      doc.setTextColor(...COLORS.text.dark);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(diff.nivel, marginX, yPos + 4);
      
      // Progress bar
      drawProgressBar(doc, marginX + 50, yPos, barWidth, 6, diff.percentual, barColor);
      
      // Stats
      doc.setTextColor(...barColor);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${diff.percentual}% (${diff.acertos}/${diff.total})`, marginX + 50 + barWidth + 5, yPos + 5);
      
      yPos += 14;
    });
  }
  
  // Footer
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado por SanarFlix Academy', 14, pageHeight - 12);
  doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 12, { align: 'right' });
};

// ============================================================================
// PAGE FOOTER
// ============================================================================

const addPageFooter = (doc: jsPDF, pageNum: number, totalPages: number): void => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  doc.setDrawColor(...COLORS.neutral.border);
  doc.setLineWidth(0.2);
  doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
  
  doc.setTextColor(...COLORS.text.muted);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado por SanarFlix Academy', 14, pageHeight - 10);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - 14, pageHeight - 10, { align: 'right' });
};

const addFootersToAllPages = (doc: jsPDF): void => {
  const totalPages = doc.getNumberOfPages();
  
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addPageFooter(doc, i, totalPages);
  }
};

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export const generateProvaRevisadaPDF = async (
  simuladoNome: string,
  alunoNome: string,
  questoes: QuestaoRevisada[],
  stats: ProvaRevisadaStats,
  onProgress?: OnProgressCallback
): Promise<void> => {
  onProgress?.('preparing');
  
  const doc = new jsPDF();
  
  // Load logo
  const logoBase64 = await loadLogoAsBase64();
  
  // Load question images in parallel (batch of 5)
  onProgress?.('loading_images', 0, questoes.filter(q => q.imagem).length);
  const imageMap = new Map<number, string | null>();
  const questoesComImagem = questoes.filter(q => q.imagem);
  
  for (let i = 0; i < questoesComImagem.length; i += 5) {
    const batch = questoesComImagem.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(q => q.imagem ? loadImageAsBase64(q.imagem) : Promise.resolve(null))
    );
    batch.forEach((q, idx) => {
      imageMap.set(q.numero, results[idx]);
    });
    onProgress?.('loading_images', Math.min(i + 5, questoesComImagem.length), questoesComImagem.length);
  }
  
  // Generate cover page
  onProgress?.('generating', 0, questoes.length);
  drawCoverPage(doc, simuladoNome, alunoNome, stats, logoBase64);
  
  // Generate question pages
  doc.addPage();
  let yPos = 20;
  
  for (let i = 0; i < questoes.length; i++) {
    const questao = questoes[i];
    const imageBase64 = imageMap.get(questao.numero) || null;
    yPos = drawQuestionBlock(doc, questao, yPos, imageBase64);
    onProgress?.('generating', i + 1, questoes.length);
  }
  
  // Generate analysis page
  drawAnalysisPage(doc, stats);
  
  // Add footers to all pages
  addFootersToAllPages(doc);
  
  onProgress?.('complete');
  
  // Generate safe filename
  const safeFileName = simuladoNome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();
  
  doc.save(`prova_revisada_${safeFileName}.pdf`);
};
