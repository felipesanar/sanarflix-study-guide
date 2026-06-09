/**
 * Extrator de imagens embutidas em planilhas .xlsx.
 *
 * Um arquivo .xlsx é, internamente, um ZIP contendo XML + mídia.
 * Bibliotecas como SheetJS leem só o conteúdo textual; aqui abrimos o ZIP
 * manualmente para extrair as imagens e descobrir em qual célula cada uma
 * está ancorada (linha + coluna). Em seguida, filtramos apenas as colunas
 * que nos interessam (Imagem do Enunciado e Imagem do Comentário).
 *
 * A vinculação imagem ↔ questão é geométrica (âncora da imagem na célula),
 * não por fórmula — é como o Excel/LibreOffice salva imagens "soltas".
 */

import JSZip from 'jszip';
import { Logger } from '@/utils/logger';

export type ExtractedImage = {
  base64: string;
  mimeType: string;
};

export type ExtractedImagesResult = {
  /** Mapa NÚMERO DA QUESTÃO (lido da coluna `numero` da planilha) → imagem do enunciado */
  enunciadoImages: Record<number, ExtractedImage>;
  /** Mapa NÚMERO DA QUESTÃO → SEGUNDA imagem do enunciado (coluna "Imagem 2 do enunciado") */
  enunciado2Images: Record<number, ExtractedImage>;
  /** Mapa NÚMERO DA QUESTÃO → imagem do comentário */
  comentarioImages: Record<number, ExtractedImage>;
  /** Estatísticas para log/debug */
  stats: {
    totalMedia: number;
    matchedEnunciado: number;
    matchedEnunciado2: number;
    matchedComentario: number;
    skippedNoAnchor: number;
    skippedWrongColumn: number;
    /** Âncoras cujas linhas não tinham número de questão preenchido */
    skippedNoQuestionNumber: number;
  };
  /**
   * Diagnóstico por imagem: onde cada uma ancorou e qual foi o desfecho.
   * Renderizado no preview quando há mídia que não casou, para o admin
   * entender (e corrigir) sem precisar abrir o console.
   */
  debug: {
    anchors: Array<{
      /** Coluna 0-based da âncora */
      col: number;
      /** Linha 1-based da planilha (já convertida de xdr:row) */
      xlsxRow: number;
      /** Número da questão lido da coluna `numero` naquela linha, se houver */
      numeroQuestao: number | null;
      /** Desfecho do casamento */
      outcome: 'enunciado' | 'enunciado2' | 'comentario' | 'sem-numero' | 'coluna-errada' | 'duplicada';
      /** Caminho de extração que detectou a âncora */
      via: 'dispimg' | 'drawing';
    }>;
  };
};

export type ExtractImagesOptions = {
  /**
   * Índices 0-based candidatos para imagens do enunciado.
   *
   * Aceita array porque na prática o usuário cola a imagem em diferentes lugares:
   * (a) na coluna dedicada "Imagem do Enunciado" se o template a tiver,
   * (b) dentro da própria célula de "Enunciado",
   * (c) na célula imediatamente à direita do enunciado (é o mais comum).
   *
   * Qualquer imagem ancorada em uma dessas colunas vira imagem de enunciado.
   */
  enunciadoColCandidates: number[];
  /**
   * Índices 0-based candidatos para a SEGUNDA imagem do enunciado,
   * vinda da coluna "Imagem 2 do enunciado". Opcional — quando vazio, o slot é ignorado.
   */
  enunciado2ColCandidates?: number[];
  /** Mesmo esquema para imagens do comentário. */
  comentarioColCandidates: number[];
  /** Índice 0-based da coluna `numero` na planilha (chave de vinculação) */
  numeroColIndex: number;
};

/**
 * A partir dos cabeçalhos da planilha, descobre os índices 0-based candidatos
 * de coluna para cada slot de imagem do simulado. Função PURA e testável —
 * concentra toda a regra de "qual coluna é qual" num só lugar.
 *
 * Convenções cobertas (o extractor casa a primeira âncora que bater):
 *  - coluna dedicada: "Imagem do Enunciado", "Imagem 2 do Enunciado", "Imagem do Comentário";
 *  - imagem colada na célula imediatamente à direita do texto (texto+1);
 *  - 2ª imagem do enunciado colada ao lado da 1ª (texto+2) — caso real das
 *    planilhas sem coluna dedicada, em que a 2ª imagem ancora na coluna G
 *    quando o enunciado está em E e a 1ª imagem em F.
 */
export function buildImageColCandidates(originalKeys: string[]): {
  enunciadoColCandidates: number[];
  enunciado2ColCandidates: number[];
  comentarioColCandidates: number[];
  numeroColIndex: number;
  imagemEnunciadoHeaderCol: number;
  imagemEnunciado2HeaderCol: number;
  enunciadoTextCol: number;
  imagemComentarioHeaderCol: number;
  comentarioTextCol: number;
} {
  const findColByHeader = (name: string) =>
    originalKeys.findIndex((k) => k.toLowerCase().trim() === name);

  const imagemEnunciadoHeaderCol = findColByHeader('imagem do enunciado');
  let imagemEnunciado2HeaderCol = -1;
  for (const c of ['imagem 2 do enunciado', 'imagem do enunciado 2', 'imagem 2 enunciado']) {
    const idx = findColByHeader(c);
    if (idx >= 0) { imagemEnunciado2HeaderCol = idx; break; }
  }
  const enunciadoTextCol = findColByHeader('enunciado');
  const imagemComentarioHeaderCol = findColByHeader('imagem do comentário');
  const comentarioTextCol = findColByHeader('comentário');
  const numeroColIndex = findColByHeader('numero');

  const uniq = (arr: number[]) => Array.from(new Set(arr.filter((i) => i >= 0)));

  const enunciadoColCandidates = uniq([
    imagemEnunciadoHeaderCol,
    enunciadoTextCol >= 0 ? enunciadoTextCol + 1 : -1,
    enunciadoTextCol,
    5, // F — convenção histórica
  ]).filter((c) => c !== imagemEnunciado2HeaderCol); // header dedicado da 2ª img é sempre da 2ª
  const comentarioColCandidates = uniq([
    imagemComentarioHeaderCol,
    comentarioTextCol >= 0 ? comentarioTextCol + 1 : -1,
    comentarioTextCol,
    12, // M — convenção histórica
  ]);
  // 2ª imagem do enunciado: coluna dedicada (SEMPRE, se houver) OU a célula 2
  // posições à direita do texto do enunciado — convenção de colar a 2ª imagem
  // ao lado da 1ª. O heurístico (texto+2) só entra se não colidir com a 1ª
  // imagem nem com o comentário; a coluna dedicada nunca é filtrada.
  const enunciado2ColCandidates = uniq([
    imagemEnunciado2HeaderCol,
    enunciadoTextCol >= 0 ? enunciadoTextCol + 2 : -1,
  ]).filter((c) =>
    c === imagemEnunciado2HeaderCol ||
    (!enunciadoColCandidates.includes(c) && !comentarioColCandidates.includes(c)),
  );

  return {
    enunciadoColCandidates,
    enunciado2ColCandidates,
    comentarioColCandidates,
    numeroColIndex,
    imagemEnunciadoHeaderCol,
    imagemEnunciado2HeaderCol,
    enunciadoTextCol,
    imagemComentarioHeaderCol,
    comentarioTextCol,
  };
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  webp: 'image/webp',
};

function inferMimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'image/png';
}

function uint8ToBase64(bytes: Uint8Array): string {
  // Conversão eficiente sem estourar a stack em arquivos grandes
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function parseXml(xmlString: string): Document {
  return new DOMParser().parseFromString(xmlString, 'application/xml');
}

function getElementsByLocalName(parent: Document | Element, localName: string): Element[] {
  return Array.from(parent.getElementsByTagName('*')).filter(
    (el) => el.localName === localName,
  );
}

function getFirstElementByLocalName(parent: Document | Element, localName: string): Element | null {
  return getElementsByLocalName(parent, localName)[0] ?? null;
}

function getAttributeAny(el: Element | null | undefined, names: string[]): string | null {
  if (!el) return null;
  for (const name of names) {
    const value = el.getAttribute(name);
    if (value) return value;
  }
  for (const attr of Array.from(el.attributes)) {
    if (names.includes(attr.name) || names.includes(attr.localName)) {
      return attr.value;
    }
  }
  return null;
}

async function resolveFirstSheetPath(zip: JSZip): Promise<string | null> {
  const workbookFile = zip.files['xl/workbook.xml'];
  const workbookRelsFile = zip.files['xl/_rels/workbook.xml.rels'];
  if (!workbookFile || !workbookRelsFile) {
    return Object.keys(zip.files).find((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)) ?? null;
  }

  const [workbookXml, workbookRelsXml] = await Promise.all([
    workbookFile.async('string'),
    workbookRelsFile.async('string'),
  ]);

  const workbookDoc = parseXml(workbookXml);
  const workbookRels = parseRels(workbookRelsXml);
  const firstSheet = getFirstElementByLocalName(workbookDoc, 'sheet');
  const relId = getAttributeAny(firstSheet, ['r:id', 'id']);
  const target = relId ? workbookRels[relId] : null;

  if (!target) {
    return Object.keys(zip.files).find((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p)) ?? null;
  }

  return resolveZipPath(relsOwnerPath('xl/_rels/workbook.xml.rels'), target);
}

/**
 * Lê um *.rels e retorna mapa { rId -> Target }.
 * Os Targets são paths relativos ao próprio .rels (ex: "../media/image1.png").
 */
function parseRels(xmlString: string): Record<string, string> {
  const doc = parseXml(xmlString);
  const map: Record<string, string> = {};
  const relations = Array.from(doc.getElementsByTagName('Relationship'));
  for (const rel of relations) {
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    if (id && target) map[id] = target;
  }
  return map;
}

/**
 * Resolve um path relativo dentro do ZIP, a partir de uma base.
 * Ex: base="xl/worksheets/sheet1.xml", target="../drawings/drawing1.xml"
 *  -> "xl/drawings/drawing1.xml"
 *
 * IMPORTANTE: a base deve ser o *part owner* (o arquivo dono), NÃO o próprio
 * `.rels`. Em OOXML, Targets em `.rels` são relativos ao dono. Use
 * `relsOwnerPath` para converter `xl/_rels/workbook.xml.rels` → `xl/workbook.xml`.
 */
function resolveZipPath(basePath: string, relativeTarget: string): string {
  // Targets absolutos (começam com "/") são relativos à raiz do pacote
  if (relativeTarget.startsWith('/')) {
    return relativeTarget.replace(/^\/+/, '');
  }
  const baseSegments = basePath.split('/').slice(0, -1);
  const relSegments = relativeTarget.split('/');
  for (const seg of relSegments) {
    if (seg === '..') baseSegments.pop();
    else if (seg !== '.' && seg !== '') baseSegments.push(seg);
  }
  return baseSegments.join('/');
}

/**
 * Converte um path de `.rels` para o path do seu *part owner* (arquivo dono).
 * Ex: "xl/_rels/workbook.xml.rels" → "xl/workbook.xml"
 *     "xl/worksheets/_rels/sheet1.xml.rels" → "xl/worksheets/sheet1.xml"
 *
 * Usar como base ao resolver Targets que vêm de dentro de um `.rels`.
 */
function relsOwnerPath(relsPath: string): string {
  const noSuffix = relsPath.replace(/\.rels$/, '');
  const segments = noSuffix.split('/');
  const relsIdx = segments.lastIndexOf('_rels');
  if (relsIdx >= 0) segments.splice(relsIdx, 1);
  return segments.join('/');
}

/** Converte letras de coluna do Excel (A, B, ..., AA) em índice 0-based. */
function colLettersToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/**
 * Constrói um mapa rowNumber (1-based, da própria planilha) → valor numérico
 * encontrado na coluna `numeroColIndex` daquela linha.
 *
 * Lê o XML da sheet diretamente, resolvendo sharedStrings quando o tipo é "s".
 * Isso é fundamental para vincular imagens ao NÚMERO DA QUESTÃO (chave canônica),
 * em vez de depender do índice geométrico da âncora — que descasa quando há
 * linhas em branco, células mescladas ou reordenação.
 */
async function buildRowToQuestionNumberMap(
  zip: JSZip,
  sheetPath: string,
  numeroColIndex: number,
): Promise<Record<number, number>> {
  const result: Record<number, number> = {};
  if (numeroColIndex < 0) return result;

  let sharedStrings: string[] = [];
  const ssFile = zip.files['xl/sharedStrings.xml'];
  if (ssFile) {
    const ssXml = await ssFile.async('string');
    const ssDoc = parseXml(ssXml);
    const siList = getElementsByLocalName(ssDoc, 'si');
    sharedStrings = siList.map((si) => {
      const tList = getElementsByLocalName(si, 't');
      return tList.map((t) => t.textContent ?? '').join('');
    });
  }

  const sheetXml = await zip.files[sheetPath].async('string');
  const sheetDoc = parseXml(sheetXml);
  const rows = getElementsByLocalName(sheetDoc, 'row');
  for (const row of rows) {
    const rAttr = row.getAttribute('r');
    if (!rAttr) continue;
    const rowNumber = parseInt(rAttr, 10);
    if (!rowNumber) continue;

    const cells = getElementsByLocalName(row, 'c');
    for (const c of cells) {
      const ref = c.getAttribute('r');
      if (!ref) continue;
      const colLetters = ref.match(/^([A-Z]+)/)?.[1];
      if (!colLetters) continue;
      const colIdx = colLettersToIndex(colLetters);
      if (colIdx !== numeroColIndex) continue;

      const type = c.getAttribute('t');
      let rawValue: string | null = null;
      if (type === 's') {
        const v = getFirstElementByLocalName(c, 'v')?.textContent;
        const idx = v ? parseInt(v, 10) : NaN;
        rawValue = Number.isFinite(idx) ? sharedStrings[idx] ?? null : null;
      } else if (type === 'inlineStr') {
        const isEl = getFirstElementByLocalName(c, 'is');
        const tEls = isEl ? getElementsByLocalName(isEl, 't') : [];
        rawValue = tEls.map((t) => t.textContent ?? '').join('');
      } else {
        rawValue = getFirstElementByLocalName(c, 'v')?.textContent ?? null;
      }

      const num = rawValue != null ? parseInt(String(rawValue).trim(), 10) : NaN;
      if (Number.isFinite(num)) {
        result[rowNumber] = num;
      }
      break;
    }
  }
  return result;
}

/**
 * Extrai imagens da primeira sheet de um arquivo .xlsx.
 *
 * @param fileBuffer ArrayBuffer do .xlsx
 * @param options índices das colunas alvo (0-based)
 */
export async function extractImagesFromXlsx(
  fileBuffer: ArrayBuffer,
  options: ExtractImagesOptions
): Promise<ExtractedImagesResult> {
  const zip = await JSZip.loadAsync(fileBuffer);

  const stats = {
    totalMedia: 0,
    matchedEnunciado: 0,
    matchedEnunciado2: 0,
    matchedComentario: 0,
    skippedNoAnchor: 0,
    skippedWrongColumn: 0,
    skippedNoQuestionNumber: 0,
  };
  const debug: ExtractedImagesResult['debug'] = { anchors: [] };

  const enunciado2ColCandidates = options.enunciado2ColCandidates ?? [];

  // 1. Lê todos os binários em xl/media/*
  const mediaFiles: Record<string, Uint8Array> = {};
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith('xl/media/') && !file.dir) {
      mediaFiles[path] = await file.async('uint8array');
      stats.totalMedia += 1;
    }
  }

  // Diagnóstico: lista todos os arquivos relevantes do XLSX
  const xlsxStructure = {
    totalMedia: stats.totalMedia,
    mediaFiles: Object.keys(mediaFiles),
    hasCellImages: !!zip.files['xl/cellimages.xml'],
    hasCellImagesRels: !!zip.files['xl/_rels/cellimages.xml.rels'],
    drawings: Object.keys(zip.files).filter((p) => p.startsWith('xl/drawings/') && p.endsWith('.xml')),
    sheetRels: Object.keys(zip.files).filter((p) => /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(p)),
    options,
  };
  Logger.info('[xlsxImageExtractor] Estrutura do XLSX:', xlsxStructure);

  if (stats.totalMedia === 0) {
    Logger.warn('[xlsxImageExtractor] Nenhuma imagem em xl/media/ — planilha sem imagens embutidas.');
    return { enunciadoImages: {}, enunciado2Images: {}, comentarioImages: {}, stats, debug };
  }

  const enunciadoImages: Record<number, ExtractedImage> = {};
  const enunciado2Images: Record<number, ExtractedImage> = {};
  const comentarioImages: Record<number, ExtractedImage> = {};

  Logger.info('[xlsxImageExtractor] >>> Iniciando extração. Opções:', options);

  // Resolve sheet path UMA VEZ e constrói o mapa rowNumber → numeroQuestao.
  // Esse mapa é a chave canônica de vinculação imagem ↔ questão (em vez do
  // índice geométrico da âncora, que descasa com linhas em branco).
  const sheetPathGlobal = await resolveFirstSheetPath(zip);
  let rowToQuestionNumber: Record<number, number> = {};
  if (sheetPathGlobal && options.numeroColIndex >= 0) {
    try {
      rowToQuestionNumber = await buildRowToQuestionNumberMap(
        zip,
        sheetPathGlobal,
        options.numeroColIndex,
      );
      Logger.info(
        '[xlsxImageExtractor] Mapa rowNumber→numeroQuestao construído:',
        Object.keys(rowToQuestionNumber).length,
        'linhas mapeadas. Amostra:',
        Object.entries(rowToQuestionNumber).slice(0, 5),
      );
    } catch (e) {
      Logger.warn('[xlsxImageExtractor] Falha ao construir mapa de números de questão:', e);
    }
  } else {
    Logger.warn(
      '[xlsxImageExtractor] numeroColIndex não fornecido ou sheet não encontrada — vinculação por número de questão desativada.',
      { sheetPathGlobal, numeroColIndex: options.numeroColIndex },
    );
  }

  // === Caminho A: formato moderno "Imagem na célula" (xl/cellimages.xml + DISPIMG) ===
  if (zip.files['xl/cellimages.xml'] && zip.files['xl/_rels/cellimages.xml.rels']) {
    try {
      const cellImagesXml = await zip.files['xl/cellimages.xml'].async('string');
      const cellImagesRelsXml = await zip.files['xl/_rels/cellimages.xml.rels'].async('string');
      const cellRels = parseRels(cellImagesRelsXml);

      // Mapa: nome lógico da imagem (ex: "ID_xxx") → caminho de mídia
      const cellDoc = parseXml(cellImagesXml);
      const cellImageEls = getElementsByLocalName(cellDoc, 'cellImage');
      const nameToMedia: Record<string, string> = {};
      for (const el of cellImageEls) {
        const pic = getFirstElementByLocalName(el, 'pic');
        const nvPr = getFirstElementByLocalName(pic ?? el, 'cNvPr');
        const name = nvPr?.getAttribute('name') ?? '';
        const blip = getFirstElementByLocalName(pic ?? el, 'blip');
        const embed = getAttributeAny(blip, ['r:embed', 'embed']);
        if (name && embed && cellRels[embed]) {
          nameToMedia[name] = resolveZipPath(relsOwnerPath('xl/_rels/cellimages.xml.rels'), cellRels[embed]);
        }
      }
      Logger.info('[xlsxImageExtractor] cellimages.xml: imagens lógicas mapeadas:', Object.keys(nameToMedia).length);

      // Lê sheet1.xml para encontrar células com =DISPIMG("ID_xxx", ...)
      const sheetPath = sheetPathGlobal;
      if (sheetPath) {
        const sheetXml = await zip.files[sheetPath].async('string');
        const dispRegex = /<c\s+r="([A-Z]+)(\d+)"[^>]*>[\s\S]*?DISPIMG\(\s*&quot;([^&]+)&quot;|<c\s+r="([A-Z]+)(\d+)"[^>]*>[\s\S]*?DISPIMG\(\s*"([^"]+)"/g;
        let match: RegExpExecArray | null;
        let dispMatches = 0;
        while ((match = dispRegex.exec(sheetXml)) !== null) {
          const colLetters = match[1] ?? match[4];
          const rowNum = parseInt(match[2] ?? match[5], 10);
          const imgName = match[3] ?? match[6];
          if (!colLetters || !rowNum || !imgName) continue;
          dispMatches += 1;
          const colIdx = colLettersToIndex(colLetters);
          const mediaPath = nameToMedia[imgName];
          const bytes = mediaPath ? mediaFiles[mediaPath] : undefined;
          if (!bytes) continue;
          const image: ExtractedImage = {
            base64: uint8ToBase64(bytes),
            mimeType: inferMimeFromPath(mediaPath),
          };
          const numeroQuestao = rowToQuestionNumber[rowNum];
          if (!numeroQuestao) {
            stats.skippedNoQuestionNumber += 1;
            debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao: null, outcome: 'sem-numero', via: 'dispimg' });
            Logger.warn('[xlsxImageExtractor] DISPIMG sem número de questão na linha', rowNum, '(coluna', colLetters, ')');
            continue;
          }
          if (options.enunciadoColCandidates.includes(colIdx)) {
            // Primeira imagem ganha — se o usuário colou em múltiplas colunas candidatas
            // (raro), ficamos com a mais à esquerda (primeira detectada).
            if (!enunciadoImages[numeroQuestao]) {
              enunciadoImages[numeroQuestao] = image;
              stats.matchedEnunciado += 1;
              debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'enunciado', via: 'dispimg' });
            } else {
              debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'duplicada', via: 'dispimg' });
            }
          } else if (enunciado2ColCandidates.includes(colIdx)) {
            if (!enunciado2Images[numeroQuestao]) {
              enunciado2Images[numeroQuestao] = image;
              stats.matchedEnunciado2 += 1;
              debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'enunciado2', via: 'dispimg' });
            } else {
              debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'duplicada', via: 'dispimg' });
            }
          } else if (options.comentarioColCandidates.includes(colIdx)) {
            if (!comentarioImages[numeroQuestao]) {
              comentarioImages[numeroQuestao] = image;
              stats.matchedComentario += 1;
              debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'comentario', via: 'dispimg' });
            } else {
              debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'duplicada', via: 'dispimg' });
            }
          } else {
            stats.skippedWrongColumn += 1;
            debug.anchors.push({ col: colIdx, xlsxRow: rowNum, numeroQuestao, outcome: 'coluna-errada', via: 'dispimg' });
          }
        }
        Logger.info('[xlsxImageExtractor] DISPIMG matches encontrados:', dispMatches, '| stats parciais:', { ...stats });
      }

      if (stats.matchedEnunciado + stats.matchedEnunciado2 + stats.matchedComentario > 0) {
        return { enunciadoImages, enunciado2Images, comentarioImages, stats, debug };
      }
    } catch (e) {
      Logger.warn('[xlsxImageExtractor] Falha ao processar cellimages.xml, caindo no caminho clássico:', e);
    }
  }

  Logger.info('[xlsxImageExtractor] >>> Entrando no caminho CLÁSSICO (drawings)');

  // 2. Descobre o(s) drawing.xml referenciado(s) pela primeira sheet
  const firstSheetPath = await resolveFirstSheetPath(zip);
  const firstSheetRels = firstSheetPath
    ? resolveZipPath(firstSheetPath, `_rels/${firstSheetPath.split('/').pop()}.rels`)
    : null;
  Logger.info('[xlsxImageExtractor] firstSheetPath:', firstSheetPath, '| firstSheetRels:', firstSheetRels);

  const sheetRelsCandidates = [
    firstSheetRels || 'xl/worksheets/_rels/sheet1.xml.rels',
  ];
  if (!zip.files[sheetRelsCandidates[0]]) {
    for (const path of Object.keys(zip.files)) {
      if (/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(path)) {
        sheetRelsCandidates.unshift(path);
        break;
      }
    }
  }
  Logger.info('[xlsxImageExtractor] sheetRelsCandidates:', sheetRelsCandidates);

  let drawingPath: string | null = null;
  for (const sheetRelsPath of sheetRelsCandidates) {
    const file = zip.files[sheetRelsPath];
    if (!file) continue;
    const xml = await file.async('string');
    const rels = parseRels(xml);
    Logger.info('[xlsxImageExtractor] Rels da sheet', sheetRelsPath, ':', rels);
    for (const target of Object.values(rels)) {
      if (target.includes('drawings/drawing')) {
        drawingPath = resolveZipPath(relsOwnerPath(sheetRelsPath), target);
        break;
      }
    }
    if (drawingPath) break;
  }
  Logger.info('[xlsxImageExtractor] drawingPath resolvido:', drawingPath);

  if (!drawingPath || !zip.files[drawingPath]) {
    Logger.warn('[xlsxImageExtractor] ❌ Drawing não encontrado — abortando caminho clássico');
    return { enunciadoImages: {}, enunciado2Images: {}, comentarioImages: {}, stats, debug };
  }

  // 3. Lê os rels do drawing
  const drawingRelsPath = resolveZipPath(
    drawingPath,
    `_rels/${drawingPath.split('/').pop()}.rels`
  );
  const drawingRelsFile = zip.files[drawingRelsPath];
  if (!drawingRelsFile) {
    Logger.warn('[xlsxImageExtractor] ❌ drawing.rels não encontrado:', drawingRelsPath);
    return { enunciadoImages: {}, enunciado2Images: {}, comentarioImages: {}, stats, debug };
  }
  const drawingRelsXml = await drawingRelsFile.async('string');
  const drawingRels = parseRels(drawingRelsXml);

  const ridToMediaPath: Record<string, string> = {};
  for (const [rid, target] of Object.entries(drawingRels)) {
    ridToMediaPath[rid] = resolveZipPath(relsOwnerPath(drawingRelsPath), target);
  }
  Logger.info('[xlsxImageExtractor] ridToMediaPath:', ridToMediaPath);

  // 4. Parseia o drawing.xml
  const drawingXml = await zip.files[drawingPath].async('string');
  Logger.info('[xlsxImageExtractor] drawing.xml (primeiros 2000 chars):', drawingXml.slice(0, 2000));
  const drawingDoc = parseXml(drawingXml);

  const anchorTags = ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor'];
  const anchors: Array<{ el: Element; tag: string }> = [];
  for (const tag of anchorTags) {
    const list = getElementsByLocalName(drawingDoc, tag);
    for (const item of list) anchors.push({ el: item, tag });
  }
  Logger.info('[xlsxImageExtractor] Âncoras encontradas:', anchors.length, '| breakdown:', {
    twoCell: anchors.filter((a) => a.tag === 'twoCellAnchor').length,
    oneCell: anchors.filter((a) => a.tag === 'oneCellAnchor').length,
    absolute: anchors.filter((a) => a.tag === 'absoluteAnchor').length,
  });

  const anchorDebug: Array<{ row: number; col: number; tag: string }> = [];

  for (const { el: anchor, tag } of anchors) {
    const fromEl = getFirstElementByLocalName(anchor, 'from');
    if (!fromEl) {
      stats.skippedNoAnchor += 1;
      continue;
    }
    const colText = getFirstElementByLocalName(fromEl, 'col')?.textContent;
    const rowText = getFirstElementByLocalName(fromEl, 'row')?.textContent;
    if (colText == null || rowText == null) {
      stats.skippedNoAnchor += 1;
      continue;
    }
    const col = parseInt(colText, 10);
    const row = parseInt(rowText, 10);
    anchorDebug.push({ row, col, tag });
    const blip = getFirstElementByLocalName(anchor, 'blip');
    const embed = getAttributeAny(blip, ['r:embed', 'embed']);
    if (!embed) continue;
    const mediaPath = ridToMediaPath[embed];
    const bytes = mediaPath ? mediaFiles[mediaPath] : undefined;
    if (!bytes) continue;
    // `row` (xdr:row) é 0-based; o número da linha real do Excel (1-based) é row+1.
    const xlsxRowNumber = row + 1;
    const numeroQuestao = rowToQuestionNumber[xlsxRowNumber];
    if (!numeroQuestao) {
      stats.skippedNoQuestionNumber += 1;
      debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao: null, outcome: 'sem-numero', via: 'drawing' });
      continue;
    }

    const image: ExtractedImage = {
      base64: uint8ToBase64(bytes),
      mimeType: inferMimeFromPath(mediaPath),
    };

    if (options.enunciadoColCandidates.includes(col)) {
      if (!enunciadoImages[numeroQuestao]) {
        enunciadoImages[numeroQuestao] = image;
        stats.matchedEnunciado += 1;
        debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'enunciado', via: 'drawing' });
      } else {
        debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'duplicada', via: 'drawing' });
      }
    } else if (enunciado2ColCandidates.includes(col)) {
      if (!enunciado2Images[numeroQuestao]) {
        enunciado2Images[numeroQuestao] = image;
        stats.matchedEnunciado2 += 1;
        debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'enunciado2', via: 'drawing' });
      } else {
        debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'duplicada', via: 'drawing' });
      }
    } else if (options.comentarioColCandidates.includes(col)) {
      if (!comentarioImages[numeroQuestao]) {
        comentarioImages[numeroQuestao] = image;
        stats.matchedComentario += 1;
        debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'comentario', via: 'drawing' });
      } else {
        debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'duplicada', via: 'drawing' });
      }
    } else {
      stats.skippedWrongColumn += 1;
      debug.anchors.push({ col, xlsxRow: xlsxRowNumber, numeroQuestao, outcome: 'coluna-errada', via: 'drawing' });
    }
  }

  Logger.info('[xlsxImageExtractor] Âncoras detalhadas:', anchorDebug.slice(0, 30));
  Logger.info('[xlsxImageExtractor] Stats finais:', stats);

  return { enunciadoImages, enunciado2Images, comentarioImages, stats, debug };
}

/**
 * Comprime/redimensiona uma imagem em base64 para reduzir o payload enviado
 * à edge function. Mantém aspect ratio e usa JPEG para imagens opacas.
 *
 * @param maxDimension lado máximo (px). Imagens menores não são alteradas.
 * @param quality 0..1 (apenas para JPEG)
 */
export async function compressBase64Image(
  base64: string,
  mimeType: string,
  maxDimension = 1280,
  quality = 0.85
): Promise<{ base64: string; mimeType: string }> {
  // PNGs com transparência não são convertidos para JPEG (perderia alpha)
  const keepPng = mimeType === 'image/png';

  const dataUrl = `data:${mimeType};base64,${base64}`;
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Falha ao carregar imagem para compressão'));
    img.src = dataUrl;
  });

  const longest = Math.max(img.width, img.height);
  if (longest <= maxDimension && base64.length < 200_000) {
    // Imagem já pequena → não recomprime
    return { base64, mimeType };
  }

  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { base64, mimeType };
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const outputMime = keepPng ? 'image/png' : 'image/jpeg';
  const outputDataUrl = canvas.toDataURL(outputMime, keepPng ? undefined : quality);
  const outputBase64 = outputDataUrl.split(',')[1] ?? base64;
  return { base64: outputBase64, mimeType: outputMime };
}
