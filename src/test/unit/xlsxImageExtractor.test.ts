import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { extractImagesFromXlsx, buildImageColCandidates } from '@/utils/xlsxImageExtractor';

/**
 * Reproduz, de forma determinística, o pipeline de extração de imagens
 * embutidas em .xlsx — incluindo o caso real "simulado com duas imagens".
 *
 * Em vez de depender de um arquivo binário gerado pelo Excel, montamos o ZIP
 * OOXML mínimo que o extractor sabe ler (sheet + drawing + media), com âncoras
 * geométricas controladas. Assim conseguimos testar o casamento imagem↔questão
 * pela coluna `numero` em cenários precisos.
 */

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

type AnchorSpec = {
  /** Coluna 0-based onde a imagem está ancorada (xdr:col) */
  col: number;
  /** Linha 0-based da âncora (xdr:row); a linha real do Excel é row+1 */
  row: number;
  /** rId do relacionamento de mídia (rId1, rId2, ...) */
  embed: string;
};

/**
 * Monta um .xlsx em memória.
 * @param numeroByRow mapa rowNumber (1-based) → valor da coluna `numero` (coluna A)
 * @param anchors imagens flutuantes ancoradas no drawing clássico
 * @param mediaCount quantos arquivos image*.png colocar em xl/media/
 */
async function buildXlsx(
  numeroByRow: Record<number, number>,
  anchors: AnchorSpec[],
  mediaCount: number,
): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">
  <sheets><sheet name="Simulado" sheetId="1" r:id="rIdSheet1"/></sheets>
</workbook>`,
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${NS_PKG}">
  <Relationship Id="rIdSheet1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  );

  // Linhas da planilha: coluna A (índice 0) = `numero`.
  const rowsXml = Object.entries(numeroByRow)
    .map(([rowNum, numero]) => `<row r="${rowNum}"><c r="A${rowNum}"><v>${numero}</v></c></row>`)
    .join('');

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">
  <sheetData>${rowsXml}</sheetData>
  <drawing r:id="rIdDrawing1"/>
</worksheet>`,
  );

  zip.file(
    'xl/worksheets/_rels/sheet1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${NS_PKG}">
  <Relationship Id="rIdDrawing1" Type="${NS_REL}/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`,
  );

  const anchorsXml = anchors
    .map(
      (a) => `<xdr:twoCellAnchor>
      <xdr:from><xdr:col>${a.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
      <xdr:to><xdr:col>${a.col + 1}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.row + 1}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
      <xdr:pic><xdr:blipFill><a:blip r:embed="${a.embed}"/></xdr:blipFill></xdr:pic>
    </xdr:twoCellAnchor>`,
    )
    .join('');

  zip.file(
    'xl/drawings/drawing1.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="${NS_REL}">${anchorsXml}</xdr:wsDr>`,
  );

  const drawingRels = Array.from({ length: mediaCount }, (_, i) => {
    const n = i + 1;
    return `<Relationship Id="rId${n}" Type="${NS_REL}/image" Target="../media/image${n}.png"/>`;
  }).join('');

  zip.file(
    'xl/drawings/_rels/drawing1.xml.rels',
    `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="${NS_PKG}">${drawingRels}</Relationships>`,
  );

  // PNG mínimo (assinatura) — basta ser bytes distintos por imagem.
  for (let i = 1; i <= mediaCount; i++) {
    zip.file('xl/media/image' + i + '.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, i]));
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

const OPTS = { enunciadoColCandidates: [4], comentarioColCandidates: [11], numeroColIndex: 0 };

describe('extractImagesFromXlsx', () => {
  it('vincula DUAS imagens a duas questões distintas (caso real do simulado)', async () => {
    // numero: linha 2 = questão 1, linha 3 = questão 2
    // imagens ancoradas na coluna E (índice 4), uma em cada linha de questão
    const buf = await buildXlsx(
      { 2: 1, 3: 2 },
      [
        { col: 4, row: 1, embed: 'rId1' }, // xdr:row 1 → xlsx row 2 → questão 1
        { col: 4, row: 2, embed: 'rId2' }, // xdr:row 2 → xlsx row 3 → questão 2
      ],
      2,
    );

    const res = await extractImagesFromXlsx(buf, OPTS);

    expect(res.stats.totalMedia).toBe(2);
    expect(res.stats.matchedEnunciado).toBe(2);
    expect(res.enunciadoImages[1]).toBeDefined();
    expect(res.enunciadoImages[2]).toBeDefined();
    // base64 distinto por imagem (não trocou as âncoras)
    expect(res.enunciadoImages[1].base64).not.toBe(res.enunciadoImages[2].base64);
  });

  it('vincula enunciado + comentário na mesma questão (dois slots)', async () => {
    const buf = await buildXlsx(
      { 2: 1 },
      [
        { col: 4, row: 1, embed: 'rId1' }, // enunciado (col 4)
        { col: 11, row: 1, embed: 'rId2' }, // comentário (col 11)
      ],
      2,
    );

    const res = await extractImagesFromXlsx(buf, OPTS);

    expect(res.stats.matchedEnunciado).toBe(1);
    expect(res.stats.matchedComentario).toBe(1);
    expect(res.enunciadoImages[1]).toBeDefined();
    expect(res.comentarioImages[1]).toBeDefined();
  });

  it('sinaliza (não silencia) duas imagens no MESMO slot da mesma questão', async () => {
    const buf = await buildXlsx(
      { 2: 1 },
      [
        { col: 4, row: 1, embed: 'rId1' },
        { col: 4, row: 1, embed: 'rId2' }, // segunda imagem, mesmo slot/questão
      ],
      2,
    );

    const res = await extractImagesFromXlsx(buf, OPTS);

    // Primeira ganha; a segunda é registrada como 'duplicada' no diagnóstico.
    expect(res.stats.matchedEnunciado).toBe(1);
    const duplicadas = res.debug.anchors.filter((a) => a.outcome === 'duplicada');
    expect(duplicadas).toHaveLength(1);
  });

  it('registra "sem-numero" quando a imagem está numa linha sem `numero` preenchido', async () => {
    // Imagem ancorada na linha 5 (xdr:row 4), mas só as linhas 2 e 3 têm numero.
    const buf = await buildXlsx(
      { 2: 1, 3: 2 },
      [{ col: 4, row: 4, embed: 'rId1' }],
      1,
    );

    const res = await extractImagesFromXlsx(buf, OPTS);

    expect(res.stats.matchedEnunciado).toBe(0);
    expect(res.stats.skippedNoQuestionNumber).toBe(1);
    expect(res.debug.anchors.some((a) => a.outcome === 'sem-numero')).toBe(true);
  });

  it('registra "coluna-errada" quando a imagem está fora das colunas esperadas', async () => {
    // Imagem na coluna B (índice 1), que não é enunciado (4) nem comentário (11).
    const buf = await buildXlsx(
      { 2: 1 },
      [{ col: 1, row: 1, embed: 'rId1' }],
      1,
    );

    const res = await extractImagesFromXlsx(buf, OPTS);

    expect(res.stats.matchedEnunciado).toBe(0);
    expect(res.stats.skippedWrongColumn).toBe(1);
    expect(res.debug.anchors.some((a) => a.outcome === 'coluna-errada')).toBe(true);
  });

  it('retorna vazio sem mídia embutida', async () => {
    const buf = await buildXlsx({ 2: 1, 3: 2 }, [], 0);
    const res = await extractImagesFromXlsx(buf, OPTS);
    expect(res.stats.totalMedia).toBe(0);
    expect(Object.keys(res.enunciadoImages)).toHaveLength(0);
  });

  it('vincula DUAS imagens do enunciado (F=1ª, G=2ª) na mesma questão', async () => {
    // Caso real: 1ª imagem na coluna F (5), 2ª imagem na coluna G (6), mesma linha.
    const buf = await buildXlsx(
      { 2: 1 },
      [
        { col: 5, row: 1, embed: 'rId1' }, // F → enunciado
        { col: 6, row: 1, embed: 'rId2' }, // G → enunciado2
      ],
      2,
    );

    const res = await extractImagesFromXlsx(buf, {
      enunciadoColCandidates: [5, 4],
      enunciado2ColCandidates: [6],
      comentarioColCandidates: [11, 10, 12],
      numeroColIndex: 0,
    });

    expect(res.stats.matchedEnunciado).toBe(1);
    expect(res.stats.matchedEnunciado2).toBe(1);
    expect(res.enunciadoImages[1]).toBeDefined();
    expect(res.enunciado2Images[1]).toBeDefined();
    expect(res.enunciadoImages[1].base64).not.toBe(res.enunciado2Images[1].base64);
  });
});

describe('buildImageColCandidates', () => {
  // Layout real que causava o bug: enunciado em E(4), comentário em K(10),
  // SEM coluna dedicada "Imagem 2 do Enunciado". A 2ª imagem é colada em G(6).
  const HEADERS_SEM_COLUNA_DEDICADA = [
    'numero', 'grande área', 'especialidade', 'tema', 'enunciado',
    'alternativa a', 'alternativa b', 'alternativa c', 'alternativa d',
    'gabarito', 'comentário',
  ];

  it('inclui a coluna 2-à-direita do enunciado (G) nos candidatos da 2ª imagem', () => {
    const r = buildImageColCandidates(HEADERS_SEM_COLUNA_DEDICADA);
    expect(r.enunciadoTextCol).toBe(4); // E
    expect(r.enunciadoColCandidates).toEqual(expect.arrayContaining([5, 4])); // F, E
    // O fix: G (6) entra como candidato da 2ª imagem mesmo sem coluna dedicada.
    expect(r.enunciado2ColCandidates).toContain(6);
  });

  it('não canibaliza: a 2ª imagem não compartilha colunas com a 1ª nem com o comentário', () => {
    const r = buildImageColCandidates(HEADERS_SEM_COLUNA_DEDICADA);
    for (const c of r.enunciado2ColCandidates) {
      expect(r.enunciadoColCandidates).not.toContain(c);
      expect(r.comentarioColCandidates).not.toContain(c);
    }
  });

  it('usa a coluna dedicada "Imagem 2 do Enunciado" quando o template a tem', () => {
    const headers = [
      'numero', 'tema', 'enunciado', 'imagem do enunciado', 'imagem 2 do enunciado',
      'alternativa a', 'gabarito', 'comentário', 'imagem do comentário',
    ];
    const r = buildImageColCandidates(headers);
    expect(r.imagemEnunciado2HeaderCol).toBe(4);
    expect(r.enunciado2ColCandidates).toContain(4);
  });

  it('aceita variações de cabeçalho da 2ª imagem ("imagem do enunciado 2")', () => {
    const headers = ['numero', 'enunciado', 'imagem do enunciado 2', 'gabarito', 'comentário'];
    const r = buildImageColCandidates(headers);
    expect(r.enunciado2ColCandidates).toContain(2);
  });
});
