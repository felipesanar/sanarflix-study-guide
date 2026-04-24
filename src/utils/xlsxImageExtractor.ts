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

export type ExtractedImage = {
  base64: string;
  mimeType: string;
};

export type ExtractedImagesResult = {
  /** Mapa NÚMERO DA QUESTÃO (lido da coluna `numero` da planilha) → imagem do enunciado */
  enunciadoImages: Record<number, ExtractedImage>;
  /** Mapa NÚMERO DA QUESTÃO → imagem do comentário */
  comentarioImages: Record<number, ExtractedImage>;
  /** Estatísticas para log/debug */
  stats: {
    totalMedia: number;
    matchedEnunciado: number;
    matchedComentario: number;
    skippedNoAnchor: number;
    skippedWrongColumn: number;
    /** Âncoras cujas linhas não tinham número de questão preenchido */
    skippedNoQuestionNumber: number;
  };
};

export type ExtractImagesOptions = {
  /** Índice 0-based da coluna alvo para imagens do enunciado */
  enunciadoColIndex: number;
  /** Índice 0-based da coluna alvo para imagens do comentário */
  comentarioColIndex: number;
  /** Índice 0-based da coluna `numero` na planilha (chave de vinculação) */
  numeroColIndex: number;
};

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

  return resolveZipPath('xl/_rels/workbook.xml.rels', target);
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
 * Resolve um path relativo dentro do ZIP.
 * Ex: base="xl/worksheets/sheet1.xml.rels", target="../drawings/drawing1.xml"
 *  -> "xl/drawings/drawing1.xml"
 */
function resolveZipPath(basePath: string, relativeTarget: string): string {
  const baseSegments = basePath.split('/').slice(0, -1);
  const relSegments = relativeTarget.split('/');
  for (const seg of relSegments) {
    if (seg === '..') baseSegments.pop();
    else if (seg !== '.' && seg !== '') baseSegments.push(seg);
  }
  return baseSegments.join('/');
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
    matchedComentario: 0,
    skippedNoAnchor: 0,
    skippedWrongColumn: 0,
    skippedNoQuestionNumber: 0,
  };

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
  console.log('[xlsxImageExtractor] Estrutura do XLSX:', xlsxStructure);

  if (stats.totalMedia === 0) {
    console.warn('[xlsxImageExtractor] Nenhuma imagem em xl/media/ — planilha sem imagens embutidas.');
    return { enunciadoImages: {}, comentarioImages: {}, stats };
  }

  const enunciadoImages: Record<number, ExtractedImage> = {};
  const comentarioImages: Record<number, ExtractedImage> = {};

  console.log('[xlsxImageExtractor] >>> Iniciando extração. Opções:', options);

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
      console.log(
        '[xlsxImageExtractor] Mapa rowNumber→numeroQuestao construído:',
        Object.keys(rowToQuestionNumber).length,
        'linhas mapeadas. Amostra:',
        Object.entries(rowToQuestionNumber).slice(0, 5),
      );
    } catch (e) {
      console.warn('[xlsxImageExtractor] Falha ao construir mapa de números de questão:', e);
    }
  } else {
    console.warn(
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
          nameToMedia[name] = resolveZipPath('xl/_rels/cellimages.xml.rels', cellRels[embed]);
        }
      }
      console.log('[xlsxImageExtractor] cellimages.xml: imagens lógicas mapeadas:', Object.keys(nameToMedia).length);

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
            console.warn('[xlsxImageExtractor] DISPIMG sem número de questão na linha', rowNum, '(coluna', colLetters, ')');
            continue;
          }
          if (colIdx === options.enunciadoColIndex) {
            enunciadoImages[numeroQuestao] = image;
            stats.matchedEnunciado += 1;
          } else if (colIdx === options.comentarioColIndex) {
            comentarioImages[numeroQuestao] = image;
            stats.matchedComentario += 1;
          } else {
            stats.skippedWrongColumn += 1;
          }
        }
        console.log('[xlsxImageExtractor] DISPIMG matches encontrados:', dispMatches, '| stats parciais:', { ...stats });
      }

      if (stats.matchedEnunciado + stats.matchedComentario > 0) {
        return { enunciadoImages, comentarioImages, stats };
      }
    } catch (e) {
      console.warn('[xlsxImageExtractor] Falha ao processar cellimages.xml, caindo no caminho clássico:', e);
    }
  }

  console.log('[xlsxImageExtractor] >>> Entrando no caminho CLÁSSICO (drawings)');

  // 2. Descobre o(s) drawing.xml referenciado(s) pela primeira sheet
  const firstSheetPath = await resolveFirstSheetPath(zip);
  const firstSheetRels = firstSheetPath
    ? resolveZipPath(firstSheetPath, `_rels/${firstSheetPath.split('/').pop()}.rels`)
    : null;
  console.log('[xlsxImageExtractor] firstSheetPath:', firstSheetPath, '| firstSheetRels:', firstSheetRels);

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
  console.log('[xlsxImageExtractor] sheetRelsCandidates:', sheetRelsCandidates);

  let drawingPath: string | null = null;
  for (const sheetRelsPath of sheetRelsCandidates) {
    const file = zip.files[sheetRelsPath];
    if (!file) continue;
    const xml = await file.async('string');
    const rels = parseRels(xml);
    console.log('[xlsxImageExtractor] Rels da sheet', sheetRelsPath, ':', rels);
    for (const target of Object.values(rels)) {
      if (target.includes('drawings/drawing')) {
        drawingPath = resolveZipPath(sheetRelsPath, target);
        break;
      }
    }
    if (drawingPath) break;
  }
  console.log('[xlsxImageExtractor] drawingPath resolvido:', drawingPath);

  if (!drawingPath || !zip.files[drawingPath]) {
    console.warn('[xlsxImageExtractor] ❌ Drawing não encontrado — abortando caminho clássico');
    return { enunciadoImages: {}, comentarioImages: {}, stats };
  }

  // 3. Lê os rels do drawing
  const drawingRelsPath = resolveZipPath(
    drawingPath,
    `_rels/${drawingPath.split('/').pop()}.rels`
  );
  const drawingRelsFile = zip.files[drawingRelsPath];
  if (!drawingRelsFile) {
    console.warn('[xlsxImageExtractor] ❌ drawing.rels não encontrado:', drawingRelsPath);
    return { enunciadoImages: {}, comentarioImages: {}, stats };
  }
  const drawingRelsXml = await drawingRelsFile.async('string');
  const drawingRels = parseRels(drawingRelsXml);

  const ridToMediaPath: Record<string, string> = {};
  for (const [rid, target] of Object.entries(drawingRels)) {
    ridToMediaPath[rid] = resolveZipPath(drawingRelsPath, target);
  }
  console.log('[xlsxImageExtractor] ridToMediaPath:', ridToMediaPath);

  // 4. Parseia o drawing.xml
  const drawingXml = await zip.files[drawingPath].async('string');
  console.log('[xlsxImageExtractor] drawing.xml (primeiros 2000 chars):', drawingXml.slice(0, 2000));
  const drawingDoc = parseXml(drawingXml);

  const anchorTags = ['twoCellAnchor', 'oneCellAnchor', 'absoluteAnchor'];
  const anchors: Array<{ el: Element; tag: string }> = [];
  for (const tag of anchorTags) {
    const list = getElementsByLocalName(drawingDoc, tag);
    for (const item of list) anchors.push({ el: item, tag });
  }
  console.log('[xlsxImageExtractor] Âncoras encontradas:', anchors.length, '| breakdown:', {
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
      continue;
    }

    const image: ExtractedImage = {
      base64: uint8ToBase64(bytes),
      mimeType: inferMimeFromPath(mediaPath),
    };

    if (col === options.enunciadoColIndex) {
      enunciadoImages[numeroQuestao] = image;
      stats.matchedEnunciado += 1;
    } else if (col === options.comentarioColIndex) {
      comentarioImages[numeroQuestao] = image;
      stats.matchedComentario += 1;
    } else {
      stats.skippedWrongColumn += 1;
    }
  }

  console.log('[xlsxImageExtractor] Âncoras detalhadas:', anchorDebug.slice(0, 30));
  console.log('[xlsxImageExtractor] Stats finais:', stats);

  return { enunciadoImages, comentarioImages, stats };
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
