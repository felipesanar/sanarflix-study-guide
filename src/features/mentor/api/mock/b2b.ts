/**
 * Dados de demonstração do protótipo `docs/handoff/mentor/prototipos/Mentor B2B.dc.html`
 * (`<script data-dc-script>`: AL, TEMAS, SESS, ROTINA, PEROLAS, QS, CARDS, SIMDATA, estado inicial).
 * Só para `VITE_MENTOR_FONTE=mock`. "Hoje" do protótipo = quinta, 15/10/2026.
 */

export const HOJE_PROTOTIPO_B2B = '2026-10-15T12:00:00-03:00';

export const MENTOR_B2B = {
  id: 'mock-mentor-beatriz',
  nome: 'Beatriz Câmara',
  agendaUrl: 'https://calendar.app.google/mock-beatriz',
  turma: { id: 'mock-turma-uniatenas-paracatu', nome: 'UniAtenas Paracatu', slug: 'uniatenas-paracatu', iesId: 'mock-ies-uniatenas', iesNome: 'UniAtenas', campus: 'Paracatu' },
  encontrosPorMes: 2,
  totalAlunos: 186,
};

/** [ordem, nome, data dd/mm | null, participantes, acerto %, proficiência média (TRI), % proficientes, conceito, status] */
export const SIMULADOS_B2B: [number, string, string | null, number | null, number | null, number | null, number | null, number | null, 'realizado' | 'agendado' | 'previsto'][] = [
  [1, '1º Simulado ENAMED', '20/05', 158, 55.2, 54.1, 41, 2, 'realizado'],
  [2, '2º Simulado ENAMED', '25/06', 166, 57.9, 55.8, 44, 3, 'realizado'],
  [3, '3º Simulado ENAMED', '27/08', 163, 60.3, 57.2, 49, 3, 'realizado'],
  [4, '4º Simulado ENAMED', '01/10', 171, 61.8, 58.4, 52, 3, 'realizado'],
  [5, '5º Simulado ENAMED', '31/10', null, null, null, null, null, 'agendado'],
  [6, '6º Simulado ENAMED', null, null, null, null, null, null, 'previsto'],
];
export const SIMULADOS_CONTRATADOS_B2B = 6;
export const PROFICIENTES_ULTIMO_B2B = 89;

export interface AlunoProtoB2b { id: string; nome: string; sem: number; p: (number | null)[]; ac: number | null; dias: number; perfil: 'virada' | 'baixo' | 'bom' | null }
export const ALUNOS_B2B: AlunoProtoB2b[] = [
  { id: 'ar', nome: 'Amanda Rocha', sem: 12, p: [61, 63, 64, 66], ac: 74, dias: 0, perfil: 'bom' },
  { id: 'bt', nome: 'Bruno Teles', sem: 11, p: [55, 57, 58, 59], ac: 63, dias: 1, perfil: 'virada' },
  { id: 'cm', nome: 'Carla Menezes', sem: 12, p: [52, 58, 61, 57], ac: 62, dias: 2, perfil: 'virada' },
  { id: 'ds', nome: 'Davi Santana', sem: 10, p: [38, 41, 39, null], ac: null, dias: 9, perfil: 'baixo' },
  { id: 'el', nome: 'Eduarda Lins', sem: 12, p: [59, 62, 60, 63], ac: 69, dias: 0, perfil: null },
  { id: 'fa', nome: 'Felipe Arruda', sem: 11, p: [57, 56, 59, 58], ac: 64, dias: 3, perfil: 'virada' },
  { id: 'gp', nome: 'Gabriela Prado', sem: 9, p: [44, 42, 47, 45], ac: 48, dias: 5, perfil: 'baixo' },
  { id: 'hc', nome: 'Heitor Campos', sem: 12, p: [70, 72, 74, 75], ac: 81, dias: 1, perfil: 'bom' },
  { id: 'im', nome: 'Isabela Moura', sem: 11, p: [null, null, 56, 58], ac: 63, dias: 0, perfil: 'virada' },
  { id: 'jr', nome: 'João Pedro Rangel', sem: 10, p: [49, 51, null, null], ac: null, dias: 19, perfil: 'baixo' },
  { id: 'lv', nome: 'Lívia Vasconcelos Teixeira', sem: 12, p: [null, null, null, null], ac: null, dias: 2, perfil: null },
];

/** [tema, grande área, especialidade, prevalência, acerto %, respostas, alunos < 50%, série 2º→4º] */
export const TEMAS_B2B: [string, string, string, 'Alta' | 'Média' | 'Baixa', number, number, number, number[]][] = [
  ['Vigilância em saúde', 'Preventiva', 'Vigilância em Saúde', 'Alta', 38, 412, 74, [44, 41, 38]],
  ['Hepatites virais', 'Clínica Médica', 'Infectologia', 'Alta', 42, 356, 66, [47, 45, 42]],
  ['Sangramento na 2ª metade da gestação', 'Ginecologia e Obstetrícia', 'Obstetrícia', 'Alta', 45, 298, 58, [39, 43, 45]],
  ['Notificação compulsória', 'Preventiva', 'Vigilância em Saúde', 'Alta', 33, 184, 81, [31, 35, 33]],
  ['Trauma: atendimento inicial', 'Cirurgia', 'Trauma', 'Média', 41, 240, 63, [46, 44, 41]],
  ['Imunização', 'Pediatria', 'Puericultura', 'Alta', 47, 322, 52, [50, 49, 47]],
  ['Rastreamento de câncer', 'Preventiva', 'Saúde do Adulto', 'Alta', 48, 276, 49, [52, 50, 48]],
  ['Insuficiência cardíaca', 'Clínica Médica', 'Cardiologia', 'Alta', 49, 301, 47, [44, 47, 49]],
  ['Síndromes hipertensivas na gestação', 'Ginecologia e Obstetrícia', 'Obstetrícia', 'Alta', 44, 190, 55, [48, 46, 44]],
  ['Abdome agudo inflamatório', 'Cirurgia', 'Cirurgia Geral', 'Média', 43, 162, 57, [40, 42, 43]],
  ['Saúde do trabalhador', 'Preventiva', 'Saúde Coletiva', 'Média', 36, 98, 70, [38, 37, 36]],
  ['Bronquiolite', 'Pediatria', 'Pneumologia Pediátrica', 'Média', 46, 121, 51, [49, 47, 46]],
  ['Transtornos de ansiedade', 'Saúde Mental', 'Psiquiatria', 'Média', 47, 88, 46, [50, 48, 47]],
  ['Sepse', 'Clínica Médica', 'Medicina Intensiva', 'Alta', 49, 214, 44, [45, 48, 49]],
  ['Queimaduras', 'Cirurgia', 'Trauma', 'Baixa', 39, 64, 49, [41, 40, 39]],
  ['Ética médica e sigilo', 'Preventiva', 'Bioética', 'Baixa', 44, 72, 40, [47, 45, 44]],
];

/** SESS: [data dd/mm, hora, tipo, tema, meet, status, gravação, aluno?, pauta [texto, referência]] */
export const SESSOES_B2B: [string, number, 'pos_simulado' | 'oficina' | 'individual', string, string | null, 'agendada' | 'realizada', boolean, string | null, [string, string][]][] = [
  ['08/10', 20, 'pos_simulado', '4º simulado: as 20 mais erradas', 'https://meet.google.com/uniatenas-posq-0810', 'realizada', true, null, []],
  ['22/10', 20, 'oficina', 'Oficina: Vigilância em saúde e Hepatites', 'https://meet.google.com/uniatenas-ofic-2210', 'agendada', false, null,
    [['Vigilância em saúde · 38% de acerto', 'vigilancia-em-saude'], ['Hepatites virais · 42% de acerto', 'hepatites-virais']]],
  ['20/10', 19, 'individual', 'Plano para a virada no 5º simulado', null, 'agendada', false, 'bt', []],
  ['05/11', 20, 'pos_simulado', '5º simulado (fecha em 31/10)', null, 'agendada', false, null, []],
  ['19/11', 20, 'oficina', 'Tema a definir', null, 'agendada', false, null, []],
  ['24/09', 20, 'oficina', 'Oficina: Imunização', 'https://meet.google.com/uniatenas-ofic-2409', 'realizada', false, null, []],
];

/** ROTINA da semana de 12/10 (ter enviado, qui pendente hoje, sex amanhã). */
export const ROTINA_SEMANA_B2B = '2026-10-12';
export const ROTINA_B2B: ['ter' | 'qui' | 'sex', 'enquete' | 'resposta' | 'perola', string, string | null][] = [
  ['ter', 'enquete', 'ECG: ritmo com QRS largo após IAM — banco de pérolas, semana 0', '2026-10-13T15:00:00Z'],
  ['qui', 'resposta', 'Gabarito comentado da enquete de terça', null],
  ['sex', 'perola', 'Material produzido pelo time pedagógico (no mural central)', null],
];

/** PEROLAS (rodízio entre mentores): [semana, mentor, no mural em dd/mm, tema] */
export const PEROLAS_B2B: [string, string, string, string][] = [
  ['1', 'Ana Carolina', '19/10', 'MFC + Cuidados paliativos'], ['2', 'Beatriz Câmara', '26/10', 'GO'], ['3', 'Julia Mendonça', '02/11', 'Dermato'],
  ['4', 'Larissa', '09/11', 'MFC'], ['5', 'Beatriz Jacobina', '16/11', 'Ped'], ['6', 'Maria Luiza', '23/11', 'GO'], ['7', 'Mariana', '30/11', 'MFC'],
  ['8', 'Letícia', '07/12', 'Dermato'], ['9', 'Gilberto Leite', '14/12', 'CG'], ['10', 'Pedro', '21/12', 'MFC'], ['11', 'Sérgio', '28/12', 'GO'],
];

/** QS (20 mais erradas do 4º): [nº, tema, grande área, acerto %, correta] */
export const QUESTOES_B2B: [number, string, string, number, string][] = [
  [17, 'Notificação compulsória', 'Preventiva', 22, 'C'], [52, 'Vigilância em saúde', 'Preventiva', 27, 'B'], [33, 'Hepatites virais', 'Clínica Médica', 31, 'A'],
  [8, 'Trauma: atendimento inicial', 'Cirurgia', 34, 'D'], [61, 'Sangramento na 2ª metade', 'Ginecologia e Obstetrícia', 35, 'C'], [44, 'Saúde do trabalhador', 'Preventiva', 36, 'B'],
  [70, 'Imunização', 'Pediatria', 38, 'A'], [25, 'Abdome agudo inflamatório', 'Cirurgia', 39, 'C'],
];

/** CARDS: [tipo, título, quem (id ou 'turma'), perfil, data dd/mm, status] */
export const CARDS_B2B: ['individual' | 'coletiva' | 'mensagem', string, string, 'virada' | 'baixo' | 'bom' | null, string, 'afazer' | 'andamento' | 'feito'][] = [
  ['individual', 'Plano para o 5º simulado', 'bt', 'virada', '14/10', 'afazer'],
  ['individual', 'Conversa: queda de 61 para 57', 'cm', 'virada', '13/10', 'andamento'],
  ['mensagem', 'Sinalizar à coordenação: sem acesso há 19 dias', 'jr', 'baixo', '10/10', 'afazer'],
  ['coletiva', 'Pós-simulado 08/10: 20 mais erradas', 'turma', null, '08/10', 'feito'],
  ['mensagem', 'Incentivo e sondagem', 'hc', 'bom', '06/10', 'feito'],
];

/** state.sinal: [aluno, motivo, data dd/mm] */
export const SINALIZACOES_B2B: [string, string, string][] = [['ds', 'Proficiência abaixo de 45 nos 3 simulados', '02/10']];

/** state.mHist: [título, tag, data dd/mm] (publicadas para a turma). */
export const MURAL_B2B: [string, 'Desempenho' | 'Aviso' | 'Fique por dentro', string][] = [
  ['Pérola: imunização do lactente', 'Fique por dentro', '09/10'],
  ['Oficina de 22/10: link e preparo', 'Aviso', '08/10'],
];

export const CANAIS_B2B = { grupo: 'https://chat.whatsapp.com/mock-pro-enamed-uniatenas' };
