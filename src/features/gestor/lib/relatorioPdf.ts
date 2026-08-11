/**
 * Motor de desenho do relatório institucional em PDF.
 *
 * Recupera a qualidade do relatório antigo do painel institucional
 * (`src/utils/institutionalReportPdf.ts`, removido junto com aquela rota):
 * capa vinho com gradiente, títulos de seção com régua, cards de KPI, tabelas
 * com cabeçalho cinza e linhas zebradas, rodapé "Gerado em … / Página X de Y".
 *
 * Aqui é só DESENHO — nenhuma regra de negócio e nenhum cálculo. Quem chama
 * (`exportarRecorte.ts`) decide o que entra e como cada número é formatado,
 * inclusive a regra do TRAÇO onde não há dado.
 *
 * jsPDF usa as fontes base (WinAnsi), que cobrem o português. Textos passam
 * por `limpar()` para remover caracteres de controle antes de ir ao papel.
 */

import jsPDF from 'jspdf';

type RGB = [number, number, number];

/** Espelha os tokens `--gp-*` do portal (tokens.light.css) em RGB para o jsPDF. */
export const COR = {
  marca: [184, 20, 20] as RGB,
  marcaForte: [102, 0, 0] as RGB,
  branco: [255, 255, 255] as RGB,
  superficie2: [249, 250, 251] as RGB,
  superficie3: [244, 245, 246] as RGB,
  linha: [233, 235, 237] as RGB,
  texto1: [17, 18, 18] as RGB,
  texto2: [65, 65, 65] as RGB,
  texto3: [137, 144, 144] as RGB,
  sucesso: [20, 145, 66] as RGB,
  alerta: [211, 136, 8] as RGB,
  perigo: [198, 29, 29] as RGB,
};

const LARGURA = 210;
const ALTURA = 297;
const MARGEM = 16;
const UTIL = LARGURA - MARGEM * 2;
const RODAPE = 18;

export type Tom = 'normal' | 'suave' | 'forte' | 'sucesso' | 'alerta' | 'perigo';

const CORES_TOM: Record<Tom, RGB> = {
  normal: COR.texto1,
  suave: COR.texto3,
  forte: COR.marca,
  sucesso: COR.sucesso,
  alerta: COR.alerta,
  perigo: COR.perigo,
};

export interface Coluna {
  titulo: string;
  /** Fração da largura útil (a soma das colunas deve dar 1). */
  fracao: number;
  alinhar?: 'esquerda' | 'centro' | 'direita';
}

export interface Celula {
  texto: string;
  tom?: Tom;
  negrito?: boolean;
}

export interface ItemKpi {
  rotulo: string;
  valor: string;
  observacao?: string;
}

function limpar(texto: string): string {
  return (texto ?? '').replace(/[\u0000-\u001F]/g, '').trim();
}

function gradiente(doc: jsPDF, x: number, y: number, w: number, h: number, de: RGB, para: RGB, passos = 60) {
  const alturaPasso = h / passos;
  for (let i = 0; i < passos; i += 1) {
    const t = i / passos;
    doc.setFillColor(
      de[0] + (para[0] - de[0]) * t,
      de[1] + (para[1] - de[1]) * t,
      de[2] + (para[2] - de[2]) * t,
    );
    doc.rect(x, y + i * alturaPasso, w, alturaPasso + 0.4, 'F');
  }
}

/**
 * Documento em construção. Uma instância por arquivo gerado — o estado
 * (página atual, cursor vertical) vive aqui e não em variáveis de módulo.
 */
export class Relatorio {
  private readonly doc: jsPDF;
  private y = MARGEM + 6;
  private temConteudo = false;

  constructor() {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  }

  /** Garante espaço vertical; abre página nova quando não couber. */
  private espaco(altura: number) {
    if (this.y + altura > ALTURA - RODAPE) {
      this.doc.addPage();
      this.y = MARGEM + 6;
    }
  }

  private texto(
    valor: string,
    x: number,
    opcoes: { tamanho?: number; negrito?: boolean; italico?: boolean; cor?: RGB; alinhar?: 'left' | 'center' | 'right' } = {},
  ) {
    const { tamanho = 9, negrito = false, italico = false, cor = COR.texto1, alinhar = 'left' } = opcoes;
    this.doc.setFont('helvetica', italico ? 'italic' : negrito ? 'bold' : 'normal');
    this.doc.setFontSize(tamanho);
    this.doc.setTextColor(cor[0], cor[1], cor[2]);
    this.doc.text(limpar(valor), x, this.y, { align: alinhar });
  }

  /** Capa: fundo em gradiente vinho, título, recorte e filtros aplicados. */
  capa(dados: { instituicao: string; recorte: string; linhas: string[]; dataExtenso: string }) {
    gradiente(this.doc, 0, 0, LARGURA, ALTURA, COR.marca, COR.marcaForte);

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.text('SANARFLIX ACADEMY', LARGURA / 2, 74, { align: 'center' });

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(27);
    this.doc.text('Relatório de', LARGURA / 2, 96, { align: 'center' });
    this.doc.text('Desempenho Institucional', LARGURA / 2, 110, { align: 'center' });

    this.doc.setDrawColor(255, 255, 255);
    this.doc.setLineWidth(0.5);
    this.doc.line(LARGURA / 2 - 22, 118, LARGURA / 2 + 22, 118);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(15);
    this.doc.text(limpar(dados.instituicao || 'Instituição'), LARGURA / 2, 132, { align: 'center' });

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(11);
    this.doc.text(limpar(dados.recorte), LARGURA / 2, 141, { align: 'center' });

    this.doc.setFontSize(9.5);
    this.doc.text(limpar(dados.dataExtenso), LARGURA / 2, 152, { align: 'center' });

    if (dados.linhas.length > 0) {
      let y = 178;
      this.doc.setFontSize(8.5);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Recorte deste relatório', LARGURA / 2, y, { align: 'center' });
      this.doc.setFont('helvetica', 'normal');
      y += 7;
      dados.linhas.forEach((linha) => {
        const partes = this.doc.splitTextToSize(limpar(linha), UTIL - 20) as string[];
        partes.forEach((parte) => {
          this.doc.text(parte, LARGURA / 2, y, { align: 'center' });
          y += 5;
        });
      });
    }
  }

  /** Sumário dos blocos escolhidos (chamado só quando vale a pena). */
  sumario(itens: string[]) {
    this.doc.addPage();
    this.y = MARGEM + 10;
    this.temConteudo = true;
    this.texto('Neste relatório', MARGEM, { tamanho: 15, negrito: true, cor: COR.marca });
    this.y += 3;
    this.doc.setDrawColor(COR.marca[0], COR.marca[1], COR.marca[2]);
    this.doc.setLineWidth(0.6);
    this.doc.line(MARGEM, this.y, MARGEM + UTIL, this.y);
    this.y += 10;

    itens.forEach((item, indice) => {
      this.espaco(9);
      this.texto(String(indice + 1).padStart(2, '0'), MARGEM, { tamanho: 9, negrito: true, cor: COR.texto3 });
      this.texto(item, MARGEM + 12, { tamanho: 10.5, cor: COR.texto1 });
      this.y += 3;
      this.doc.setDrawColor(COR.linha[0], COR.linha[1], COR.linha[2]);
      this.doc.setLineWidth(0.2);
      this.doc.line(MARGEM, this.y, MARGEM + UTIL, this.y);
      this.y += 6;
    });
  }

  /** Título de seção. Sempre começa uma página nova, como no relatório antigo. */
  secao(titulo: string, descricao?: string) {
    if (this.temConteudo) this.doc.addPage();
    this.y = MARGEM + 10;
    this.temConteudo = true;

    this.texto(titulo, MARGEM, { tamanho: 15, negrito: true, cor: COR.marca });
    this.y += 3;
    this.doc.setDrawColor(COR.marca[0], COR.marca[1], COR.marca[2]);
    this.doc.setLineWidth(0.6);
    this.doc.line(MARGEM, this.y, MARGEM + UTIL, this.y);
    this.y += 7;

    if (descricao) {
      const partes = this.doc.splitTextToSize(limpar(descricao), UTIL) as string[];
      partes.forEach((parte) => {
        this.texto(parte, MARGEM, { tamanho: 9, cor: COR.texto3 });
        this.y += 4.6;
      });
      this.y += 3;
    }
  }

  /** Sub-título dentro de uma seção. */
  subtitulo(texto: string) {
    this.espaco(14);
    this.y += 2;
    this.texto(texto, MARGEM, { tamanho: 11, negrito: true, cor: COR.texto1 });
    this.y += 7;
  }

  /** Cards de KPI, dois por linha. */
  kpis(itens: ItemKpi[]) {
    const larguraCard = UTIL / 2 - 2.5;
    const alturaCard = 22;

    for (let i = 0; i < itens.length; i += 2) {
      this.espaco(alturaCard + 4);
      const linha = itens.slice(i, i + 2);
      linha.forEach((item, coluna) => {
        const x = MARGEM + coluna * (larguraCard + 5);
        this.doc.setFillColor(COR.superficie2[0], COR.superficie2[1], COR.superficie2[2]);
        this.doc.setDrawColor(COR.linha[0], COR.linha[1], COR.linha[2]);
        this.doc.setLineWidth(0.2);
        this.doc.roundedRect(x, this.y, larguraCard, alturaCard, 2.5, 2.5, 'FD');

        this.doc.setFillColor(COR.marca[0], COR.marca[1], COR.marca[2]);
        this.doc.rect(x, this.y, 1.4, alturaCard, 'F');

        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(7.5);
        this.doc.setTextColor(COR.texto3[0], COR.texto3[1], COR.texto3[2]);
        this.doc.text(limpar(item.rotulo).toUpperCase(), x + 5, this.y + 6.5);

        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(16);
        this.doc.setTextColor(COR.texto1[0], COR.texto1[1], COR.texto1[2]);
        this.doc.text(limpar(item.valor), x + 5, this.y + 15);

        if (item.observacao) {
          this.doc.setFont('helvetica', 'normal');
          this.doc.setFontSize(7.5);
          this.doc.setTextColor(COR.texto3[0], COR.texto3[1], COR.texto3[2]);
          const cortado = (this.doc.splitTextToSize(limpar(item.observacao), larguraCard - 10) as string[])[0] ?? '';
          this.doc.text(cortado, x + 5, this.y + 19.5);
        }
      });
      this.y += alturaCard + 5;
    }
  }

  /** Tabela zebrada, com cabeçalho repetido a cada quebra de página. */
  tabela(colunas: Coluna[], linhas: Celula[][], vazio = 'Sem dados para este recorte.') {
    const larguras = colunas.map((c) => c.fracao * UTIL);
    const inicios = larguras.map((_, i) => MARGEM + larguras.slice(0, i).reduce((a, b) => a + b, 0));

    const posicao = (i: number): { x: number; align: 'left' | 'center' | 'right' } => {
      const alinhar = colunas[i]?.alinhar ?? 'esquerda';
      if (alinhar === 'direita') return { x: inicios[i] + larguras[i] - 2, align: 'right' };
      if (alinhar === 'centro') return { x: inicios[i] + larguras[i] / 2, align: 'center' };
      return { x: inicios[i] + 1.5, align: 'left' };
    };

    const cabecalho = () => {
      this.espaco(11);
      this.doc.setFillColor(COR.superficie3[0], COR.superficie3[1], COR.superficie3[2]);
      this.doc.rect(MARGEM, this.y, UTIL, 7, 'F');
      this.y += 4.8;
      colunas.forEach((coluna, i) => {
        const { x, align } = posicao(i);
        this.texto(coluna.titulo, x, { tamanho: 7.5, negrito: true, cor: COR.texto2, alinhar: align });
      });
      this.y += 4.4;
    };

    cabecalho();

    if (linhas.length === 0) {
      this.espaco(8);
      this.texto(vazio, MARGEM + 1.5, { tamanho: 8.5, italico: true, cor: COR.texto3 });
      this.y += 8;
      return;
    }

    linhas.forEach((linha, indice) => {
      const alturas = linha.map((celula, i) =>
        (this.doc.splitTextToSize(limpar(celula.texto), larguras[i] - 3) as string[]).length,
      );
      const linhasTexto = Math.max(1, ...alturas);
      const altura = 4 + linhasTexto * 3.9;

      if (this.y + altura > ALTURA - RODAPE) {
        this.doc.addPage();
        this.y = MARGEM + 6;
        cabecalho();
      }

      if (indice % 2 === 1) {
        this.doc.setFillColor(COR.superficie2[0], COR.superficie2[1], COR.superficie2[2]);
        this.doc.rect(MARGEM, this.y, UTIL, altura, 'F');
      }

      const base = this.y;
      linha.forEach((celula, i) => {
        const { x, align } = posicao(i);
        const partes = this.doc.splitTextToSize(limpar(celula.texto), larguras[i] - 3) as string[];
        partes.forEach((parte, j) => {
          this.y = base + 4.4 + j * 3.9;
          this.texto(parte, x, {
            tamanho: 8,
            negrito: celula.negrito,
            cor: CORES_TOM[celula.tom ?? 'normal'],
            alinhar: align,
          });
        });
      });

      this.y = base + altura;
      this.doc.setDrawColor(COR.linha[0], COR.linha[1], COR.linha[2]);
      this.doc.setLineWidth(0.15);
      this.doc.line(MARGEM, this.y, MARGEM + UTIL, this.y);
    });

    this.y += 6;
  }

  /** Nota de rodapé de seção (aviso de LGPD, limites de amostra, etc.). */
  nota(texto: string, destaque = false) {
    const partes = this.doc.splitTextToSize(limpar(texto), UTIL - 8) as string[];
    this.espaco(partes.length * 4.2 + 8);
    const altura = partes.length * 4.2 + 6;
    if (destaque) {
      this.doc.setFillColor(252, 227, 227);
      this.doc.roundedRect(MARGEM, this.y, UTIL, altura, 2, 2, 'F');
    }
    const base = this.y;
    partes.forEach((parte, i) => {
      this.y = base + 4.6 + i * 4.2;
      this.texto(parte, MARGEM + 4, {
        tamanho: 7.8,
        italico: !destaque,
        cor: destaque ? COR.marcaForte : COR.texto3,
      });
    });
    this.y = base + altura + 4;
  }

  /** Rodapé paginado em todas as páginas e download do arquivo. */
  finalizar(nomeArquivo: string, geradoEm: string): string {
    const total = this.doc.getNumberOfPages();
    for (let pagina = 1; pagina <= total; pagina += 1) {
      this.doc.setPage(pagina);
      if (pagina === 1) continue; // a capa não leva rodapé sobre o gradiente
      this.doc.setDrawColor(COR.linha[0], COR.linha[1], COR.linha[2]);
      this.doc.setLineWidth(0.2);
      this.doc.line(MARGEM, ALTURA - 13, LARGURA - MARGEM, ALTURA - 13);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(COR.texto3[0], COR.texto3[1], COR.texto3[2]);
      this.doc.text(`Gerado em ${geradoEm}`, MARGEM, ALTURA - 8);
      this.doc.text(`Página ${pagina} de ${total}`, LARGURA - MARGEM, ALTURA - 8, { align: 'right' });
    }
    this.doc.save(nomeArquivo);
    return nomeArquivo;
  }
}
