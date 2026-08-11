import { jsPDF } from 'jspdf';
import fs from 'fs';
(jsPDF as any).prototype.save = function (name: string) {
  fs.writeFileSync('/tmp/exp/' + name.replace(/[^\w.-]/g, '_'), Buffer.from(this.output('arraybuffer')));
  return this;
};
import * as XLSX from 'xlsx';
(XLSX as any).writeFile = (wb: any, name: string) => {
  XLSX.writeFileSync ? null : null;
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  fs.writeFileSync('/tmp/exp/' + name.replace(/[^\w.-]/g, '_'), buf);
};
const mod = await import('../src/features/gestor/lib/exportarRecorte.ts');
const nomes = ['Ana Beatriz de Oliveira Santos Ribeiro do Nascimento','Bruno Costa','Carla Mendes de Souza','Diego Fernandes Albuquerque Filho'];
const grupos = ['proficiente','em_variacao','critico','sem_dados'];
const alunos = Array.from({ length: 130 }, (_, i) => ({
  id: String(i), nome: `${nomes[i % 4]} ${i}`, semestre: i % 2 ? (i % 12) + 1 : null,
  grupo: grupos[i % 4], tendencia: ['subiu','caiu','estavel','sem_dados'][i % 4],
  proficiencias: [{ simuladoId: 'a', valor: i % 5 === 0 ? null : 30 + (i % 60) }, { simuladoId: 'b', valor: i % 7 === 0 ? null : 40 + (i % 50) }],
}));
const dados: any = {
  iesNome: 'FAI - Faculdade de Ensino Superior', semestreRotulo: 'Todos os semestres',
  simuladosRotulos: ['Simulado 1', 'Simulado 2'], alunos,
  visaoGeral: { alunosMatriculadosNoRecorte: 130, kpis: [], proficienciaPorSemestre: [], evolucao: [], distribuicao: [] },
};
console.log(Object.keys(mod));
console.log(mod.exportarRecortePdf(dados, ['alunos']));
console.log(mod.exportarRecorteXlsx(dados, ['alunos']));
