/**
 * Gerador em lote dos relatórios institucionais do grupo UNIATENAS
 * (Simulado 4), usando a MESMA engine do botão "Exportar dados" do portal.
 * Uso interno, descartável — não faz parte do app.
 */
import fs from 'node:fs';
import path from 'node:path';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { exportarRecortePdf, exportarRecorteXlsx, nomeArquivoExport } from '@/features/gestor/lib/exportarRecorte';

const SAIDA = process.env.SAIDA_RELATORIOS ?? '/mnt/documents/relatorios-uniatenas-simulado-4';
fs.mkdirSync(SAIDA, { recursive: true });

// jsPDF/XLSX gravam em disco em vez de disparar download do navegador.
(jsPDF as unknown as { prototype: Record<string, unknown> }).prototype.save = function (
  this: { output: (t: string) => ArrayBuffer },
  nome: string,
) {
  fs.writeFileSync(path.join(SAIDA, nome), Buffer.from(this.output('arraybuffer')));
  return this;
};
const writeFileOriginal = XLSX.writeFile;
(XLSX as unknown as { writeFile: typeof XLSX.writeFile }).writeFile = ((livro: XLSX.WorkBook, nome: string) =>
  writeFileOriginal(livro, path.join(SAIDA, nome))) as typeof XLSX.writeFile;

const SIMULADO = 'a8638b83-a7b7-4139-bdac-aec319470683';
const SIMULADO_NOME = 'UNIATENAS - 4º, 5º e 6º Ano | Simulado 4';
const TOKEN = 'uniatenas-sim4-2026-08-11-tmp-9f3a';
const URL = `${process.env.SUPABASE_URL}/functions/v1/tmp-relatorio`;

interface Recorte {
  ies: string;
  iesNome: string;
  gestor: string;
  semestre: string;
  rotulo: string;
}

const IES = [
  { id: 'd86c32ba-2d09-4c7e-a426-1d981ec7b595', nome: 'PARACATU', gestor: '316899fb-f03d-4810-babd-e26faac317d6', semestres: ['7', '9', '11', '6ano'] },
  { id: '9baa1401-bf54-4451-b96c-49e4823564fb', nome: 'PASSOS', gestor: '50086f3c-4473-46c2-986b-3553cb2147bb', semestres: ['7', '9', '11', '6ano'] },
  { id: '08cc7497-7ce6-49d8-828e-d6c897716cb7', nome: 'PORTO SEGURO', gestor: '0df1eba1-fe28-46ba-b3d9-9f1713474f4a', semestres: ['7', '9'] },
  { id: 'a1f1e8ca-a58e-4f87-abfe-4cc62aa4a686', nome: 'SETE LAGOAS', gestor: '59a5af2d-4490-4013-8b5e-d3821e11d1e4', semestres: ['7', '9', '11', '6ano'] },
  { id: '6e69a5e4-daab-4322-b70b-cdcf9f3c2cf9', nome: 'SORRISO', gestor: '916c44af-2f88-4191-b8eb-1a6d3e25ef76', semestres: ['7', '9', '10'] },
  { id: 'ac2f94a5-d33b-4547-94ed-ae4d0877fbc7', nome: 'VALENÇA', gestor: 'e88b01fc-cd4f-4277-a9b6-a076709f2b4b', semestres: ['7', '9', '11', '6ano'] },
];

const ANO: Record<string, string> = { '7': '4º ano', '8': '4º ano', '9': '5º ano', '10': '5º ano', '11': '6º ano', '12': '6º ano', '6ano': '6º ano' };
const rotulo = (semestre: string) =>
  semestre === '6ano' ? '6º ano (11º e 12º períodos)' : `${ANO[semestre]} — ${semestre}º período`;


async function buscar(r: Recorte) {
  const resposta = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tmp-token': TOKEN },
    body: JSON.stringify({ uid: r.gestor, iesId: r.ies, semestre: r.semestre, simulados: [SIMULADO] }),
  });
  if (!resposta.ok) throw new Error(`${r.iesNome}/${r.semestre}: HTTP ${resposta.status}`);
  return (await resposta.json()) as {
    visaoGeral: { data: unknown; meta: unknown } | null;
    detalhamento: { data: unknown; meta: unknown } | null;
    erroVisaoGeral: string | null;
    erroDetalhamento: string | null;
  };
}

const slug = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const gerados: string[] = [];
const pulados: string[] = [];

for (const ies of IES) {
  for (const semestre of ies.semestres) {
    const r: Recorte = { ies: ies.id, iesNome: ies.nome, gestor: ies.gestor, semestre, rotulo: rotulo(semestre) };
    const bruto = await buscar(r);
    if (bruto.erroVisaoGeral || !bruto.visaoGeral?.data) {
      pulados.push(`${ies.nome} · ${r.rotulo} — ${bruto.erroVisaoGeral ?? 'sem dado'}`);
      continue;
    }
    const dados = {
      iesNome: ies.nome,
      semestreRotulo: r.rotulo,
      simuladosRotulos: [SIMULADO_NOME],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      visaoGeral: (bruto.visaoGeral as any).data,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      detalhamento: (bruto.detalhamento as any)?.data,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      meta: (bruto.visaoGeral as any).meta,
    };
    const blocos = ['indicadores', 'evolucao', 'areas', 'distribuicao', 'metricasSimulados', 'acertoSemestre'] as never[];

    const alvo = `${slug(ies.nome)}_${slug(r.rotulo)}`;
    const pdf = exportarRecortePdf(dados as never, blocos);
    fs.renameSync(path.join(SAIDA, pdf), path.join(SAIDA, `${alvo}.pdf`));
    const xlsx = exportarRecorteXlsx(dados as never, blocos);
    fs.renameSync(path.join(SAIDA, xlsx), path.join(SAIDA, `${alvo}.xlsx`));
    gerados.push(`${alvo} (${nomeArquivoExport(dados as never, 'pdf')})`);
    process.stdout.write(`ok ${alvo}\n`);
  }
}

console.log(`\ngerados: ${gerados.length}`);
if (pulados.length) console.log(`pulados:\n${pulados.join('\n')}`);
