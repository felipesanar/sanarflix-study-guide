/**
 * Dados de demonstração do protótipo `docs/handoff/mentor/prototipos/Mentor B2C.dc.html`
 * (`<script data-dc-script>`: TRIBOS, SIMDATA, AL, TEMAS, QUESTOES, QX, AREAS, AREA_ESP, CARDS, SESS, HIST, LOGS).
 * Só para `VITE_MENTOR_FONTE=mock`. Nunca levar estes números para produção.
 * "Hoje" do protótipo = 15/10/2026.
 */

export const HOJE_PROTOTIPO_B2C = '2026-10-15T12:00:00-03:00';

export const MENTOR_B2C = {
  id: 'mock-mentor-thiago',
  nome: 'Thiago Taniguchi',
  agendaUrl: 'https://calendar.app.google/mock-thiago',
  tribo: { id: 'mock-tribo-carcara', nome: 'Carcará', slug: 'carcara' as const },
};

/** [ordem, nome, data dd/mm, participantes, acerto médio, % possível aprovação, status] */
export const SIMULADOS_B2C: [number, string, string, number | null, number | null, number | null, 'realizado' | 'agendado'][] = [
  [1, '1º Simulado PRO', '25/05', 80, 72, 19, 'realizado'],
  [2, '2º Simulado PRO', '29/06', 77, 74, 24, 'realizado'],
  [3, '3º Simulado PRO', '27/07', 74, 76, 26, 'realizado'],
  [4, '4º Simulado PRO', '24/08', 71, 77, 28, 'realizado'],
  [5, '5º Simulado PRO', '21/09', 62, 79, 34, 'realizado'],
  [6, '6º Simulado PRO', '09/11', null, null, null, 'agendado'],
];

export interface AlunoProtoB2c {
  id: string; nome: string; acesso: string; meta: string; inst: string; corte: number;
  sims: (number | null)[]; dias: number; tel: string;
}
export const ALUNOS_B2C: AlunoProtoB2c[] = [
  { id: 'bs', nome: 'Beatriz Sampaio', acesso: 'dez/26', meta: 'Dermatologia', inst: 'USP-SP', corte: 84, sims: [81, 84, 85, 85, 87], dias: 0, tel: '(71) 9 9641-2280' },
  { id: 'cm', nome: 'Caio Menezes', acesso: 'dez/26', meta: 'Cardiologia', inst: 'UNIFESP', corte: 82, sims: [78, 83, 80, 84, 79], dias: 1, tel: '(71) 9 9812-4407' },
  { id: 'rn', nome: 'Rafael Nogueira', acesso: 'jun/27', meta: 'Neurologia', inst: 'USP-SP', corte: 85, sims: [80, 83, 82, 83, 77], dias: 4, tel: '(75) 9 8120-3391' },
  { id: 'lc', nome: 'Luana Castro', acesso: 'dez/26', meta: 'Ginecologia e Obstetrícia', inst: 'UNIFESP', corte: 80, sims: [74, 78, 80, 82, 76], dias: 2, tel: '(11) 9 7731-0954' },
  { id: 'dp', nome: 'Diego Pacheco', acesso: 'jun/27', meta: 'Oftalmologia', inst: 'USP-SP', corte: 86, sims: [70, 73, 72, 73, 74], dias: 3, tel: '(81) 9 9902-1178' },
  { id: 'hq', nome: 'Helena Queiroz', acesso: 'dez/26', meta: 'Pediatria', inst: 'SUS-SP', corte: 78, sims: [77, 79, 77, null, 78], dias: 0, tel: '(71) 9 9255-6013' },
  { id: 'lf', nome: 'Larissa Freitas', acesso: 'dez/26', meta: 'Psiquiatria', inst: 'HCPA', corte: 80, sims: [82, 81, 85, 84, 85], dias: 2, tel: '(51) 9 8433-7720' },
  { id: 'ma', nome: 'Marina Albuquerque', acesso: 'dez/26', meta: 'Dermatologia', inst: 'USP-SP', corte: 84, sims: [68, 70, 69, null, null], dias: 17, tel: '(79) 9 9104-5582' },
  { id: 'js', nome: 'João Siqueira', acesso: 'mar/27', meta: 'Ortopedia', inst: 'IOT-HCFMUSP', corte: 83, sims: [72, 71, null, 74, null], dias: 22, tel: '(71) 9 9370-8841' },
  { id: 'tv', nome: 'Tainá Vasconcelos', acesso: 'dez/26', meta: 'Pediatria', inst: 'SUS-SP', corte: 78, sims: [79, 80, 81, 82, 83], dias: 1, tel: '(84) 9 9616-2047' },
  { id: 'ol', nome: 'Otávio Lins', acesso: 'jun/27', meta: 'Cirurgia Geral', inst: 'UNICAMP', corte: 81, sims: [null, null, null, null, 77], dias: 0, tel: '(19) 9 9188-4302' },
  { id: 'rb', nome: 'Renata Bastos Albuquerque de Melo', acesso: 'dez/26', meta: 'Medicina de Família e Comunidade', inst: 'SUS-SP', corte: 72, sims: [64, null, 66, 65, null], dias: 15, tel: '(71) 9 9022-6719' },
];

/** [tema, grande área, prevalência, acerto %, respostas, alunos < 50%] */
export const TEMAS_B2C: [string, string, 'Alta' | 'Média' | 'Baixa', number, number, number][] = [
  ['Vigilância em saúde', 'Preventiva', 'Alta', 44, 312, 41], ['Hepatites virais', 'Clínica Médica', 'Alta', 51, 248, 33],
  ['Sangramento na 2ª metade', 'Ginecologia e Obstetrícia', 'Alta', 55, 190, 28], ['Trauma: atendimento inicial', 'Cirurgia', 'Média', 53, 164, 30],
  ['Imunização', 'Pediatria', 'Alta', 60, 221, 22], ['Rastreamento de câncer', 'Preventiva', 'Alta', 61, 207, 24],
  ['Insuficiência cardíaca', 'Clínica Médica', 'Alta', 62, 233, 21], ['Abdome agudo inflamatório', 'Cirurgia', 'Média', 58, 96, 19],
  ['Assistência ao pré-natal', 'Ginecologia e Obstetrícia', 'Alta', 63, 178, 20], ['Saúde do trabalhador', 'Preventiva', 'Média', 57, 74, 18],
  ['Bronquiolite', 'Pediatria', 'Média', 64, 88, 15], ['Transtornos de ansiedade', 'Saúde Mental', 'Média', 66, 61, 12],
];

export interface QuestaoProto {
  n: number; tema: string; area: string; acerto: number; enun: string; alts: [string, number][]; certa: string; dom: string; domN: number;
  esp: string; textos: Record<string, string>;
}
export const QUESTOES_PROTO: QuestaoProto[] = [
  { n: 12, tema: 'Vigilância em saúde', area: 'Preventiva', acerto: 31, enun: 'Paciente com suspeita de sarampo atendido na UBS. Qual a conduta quanto à notificação e em que prazo?', alts: [['A', 9], ['B', 14], ['C', 46], ['D', 31]], certa: 'D', dom: 'C', domN: 27,
    esp: 'Vigilância em Saúde', textos: { A: 'Notificar semanalmente, junto com os demais agravos de notificação compulsória.', B: 'Notificar em até 7 dias, após a avaliação do pediatra de referência.', C: 'Notificar apenas após a confirmação laboratorial por sorologia.', D: 'Notificar de forma imediata, em até 24 horas, já na suspeita.' } },
  { n: 47, tema: 'Hepatites virais', area: 'Clínica Médica', acerto: 38, enun: 'Gestante com HBsAg reagente e HBeAg reagente no 3º trimestre. Qual a medida para reduzir a transmissão vertical?', alts: [['A', 38], ['B', 33], ['C', 18], ['D', 11]], certa: 'A', dom: 'B', domN: 20,
    esp: 'Hepatologia', textos: { A: 'Imunoglobulina e vacina para o recém-nascido nas primeiras 12 horas.', B: 'Cesárea eletiva para evitar a transmissão.', C: 'Contraindicar o aleitamento materno.', D: 'Iniciar interferon no 3º trimestre.' } },
  { n: 63, tema: 'Sangramento na 2ª metade', area: 'Ginecologia e Obstetrícia', acerto: 44, enun: 'Gestante de 34 semanas com sangramento vermelho-vivo indolor. Qual o próximo passo?', alts: [['A', 21], ['B', 44], ['C', 26], ['D', 9]], certa: 'B', dom: 'C', domN: 16,
    esp: 'Obstetrícia', textos: { A: 'Toque vaginal para avaliar o colo.', B: 'Ultrassonografia antes de qualquer toque.', C: 'Indução imediata do parto.', D: 'Tocolítico e alta com retorno.' } },
  { n: 8, tema: 'Trauma: atendimento inicial', area: 'Cirurgia', acerto: 49, enun: 'Vítima de colisão, Glasgow 8, saturação 88%. Qual a prioridade imediata?', alts: [['A', 49], ['B', 12], ['C', 30], ['D', 9]], certa: 'A', dom: 'C', domN: 18,
    esp: 'Trauma', textos: { A: 'Via aérea definitiva com proteção da coluna cervical.', B: 'Dois acessos venosos calibrosos.', C: 'Tomografia de crânio.', D: 'Avaliação neurológica completa.' } },
  { n: 71, tema: 'Imunização', area: 'Pediatria', acerto: 57, enun: 'Lactente de 6 meses com calendário atrasado. Quais vacinas podem ser feitas na mesma visita?', alts: [['A', 17], ['B', 57], ['C', 15], ['D', 11]], certa: 'B', dom: 'A', domN: 10,
    esp: 'Puericultura', textos: { A: 'Só a vacina mais atrasada; as demais no próximo mês.', B: 'Todas as vacinas em atraso, na mesma visita.', C: 'Reiniciar o esquema aos 12 meses.', D: 'Apenas as vacinas orais.' } },
  { n: 22, tema: 'Insuficiência cardíaca', area: 'Clínica Médica', acerto: 83, enun: 'Paciente com ICFEr em uso de IECA e betabloqueador, ainda sintomático. Qual a próxima droga com benefício em mortalidade?', alts: [['A', 6], ['B', 83], ['C', 7], ['D', 4]], certa: 'B', dom: 'C', domN: 4,
    esp: 'Cardiologia', textos: { A: 'Digoxina.', B: 'Espironolactona.', C: 'Furosemida em dose alta.', D: 'Amiodarona.' } },
];

/** AREA_ESP: grande área → [especialidade, acerto %, respostas, temas?: [tema, respostas, acerto %]] */
export const AREA_ESP: Record<string, [string, number, number, [string, number, number][]?][]> = {
  'Clínica Médica': [['Cardiologia', 84, 410], ['Hepatologia', 61, 236], ['Endocrinologia', 79, 198]],
  'Cirurgia': [['Trauma', 63, 240], ['Cirurgia Geral', 74, 212], ['Urologia', 78, 96]],
  'Ginecologia e Obstetrícia': [['Obstetrícia', 66, 298], ['Ginecologia', 77, 174]],
  'Pediatria': [['Puericultura', 64, 221], ['Neonatologia', 79, 150], ['Infectologia Pediátrica', 82, 120]],
  'Preventiva': [['Vigilância em Saúde', 44, 312, [['Notificação compulsória', 96, 28], ['Investigação de surtos', 112, 49], ['Sistemas de informação', 104, 58]]], ['Epidemiologia', 58, 180, [['Medidas de associação', 92, 52], ['Estudos diagnósticos', 88, 64]]], ['Políticas de Saúde', 63, 180], ['Saúde do Trabalhador', 66, 180]],
  'Medicina de Família e Comunidade': [['Atenção Primária', 76, 160], ['Abordagem familiar', 72, 90]],
  'Saúde Mental': [['Psiquiatria', 83, 120], ['Dependência química', 79, 64]],
};
/** AREAS: acerto da grande área (ordem do protótipo). */
export const AREAS_ACERTO: [string, number][] = [
  ['Preventiva', 63], ['Ginecologia e Obstetrícia', 73], ['Medicina de Família e Comunidade', 74], ['Cirurgia', 75], ['Pediatria', 80], ['Clínica Médica', 84], ['Saúde Mental', 88],
];

/** CARDS: [tipo, título, quem, origem, data dd/mm, status, nota?] — quem: id do aluno, 'turma', 'sumiram', 'regrediram'. */
export const CARDS_B2C: ['individual' | 'coletiva' | 'mensagem', string, string, 'agenda_liberada' | 'tema_critico' | 'manual' | 'sessao_criada' | 'mural', string, 'afazer' | 'andamento' | 'feito', string?][] = [
  ['individual', 'Conversa sobre a queda no 5º simulado', 'cm', 'agenda_liberada', '29/09', 'afazer'],
  ['coletiva', 'Vigilância em saúde: 44% de acerto da turma', 'turma', 'tema_critico', '30/09', 'afazer'],
  ['mensagem', 'Chamar no WhatsApp os que sumiram', 'sumiram', 'manual', '30/09', 'afazer'],
  ['coletiva', 'Encontro de 16/10: últimas 6 semanas', 'turma', 'sessao_criada', '25/09', 'andamento', 'Falta o link do Meet. Pedir tema pro grupo na segunda.'],
  ['individual', 'Entender por que sumiu', 'ma', 'manual', '26/09', 'andamento', 'Mandei áudio; respondeu que está em prova da faculdade. Retomar 06/10.'],
  ['mensagem', 'Mural: sua nota caiu, vamos entender', 'regrediram', 'mural', '27/09', 'feito', '3 responderam no grupo.'],
  ['individual', 'Replanejar meta: USP-SP x SUS-SP', 'dp', 'agenda_liberada', '19/09', 'feito', 'Manteve USP-SP. Vai priorizar Preventiva.'],
];

/** SESS: [data dd/mm, hora, tipo, quem (id do aluno ou 'turma'), tema, meet, status, gravação?] */
export const SESSOES_B2C: [string, number, 'encontro_tribo' | 'individual', string, string, string | null, 'agendada' | 'realizada', boolean?][] = [
  ['16/10', 19, 'encontro_tribo', 'turma', 'Como estudar as últimas 6 semanas', null, 'agendada'],
  ['19/10', 20, 'individual', 'dp', 'Rever meta USP-SP', null, 'agendada'],
  ['20/10', 18, 'individual', 'cm', 'Queda no 5º simulado', null, 'agendada'],
  ['12/11', 19, 'encontro_tribo', 'turma', 'Reta final: o que revisar', 'https://meet.google.com/kfx-qwbr-tpa', 'agendada'],
  ['14/10', 18, 'individual', 'lf', 'Plano para o 6º simulado', null, 'realizada'],
  ['17/09', 19, 'encontro_tribo', 'turma', 'Pós 4º simulado: Preventiva', 'https://meet.google.com/abq-ruty-mne', 'realizada', true],
];

/** HIST: [título, tag, para (id do aluno, 'regrediram' ou 'turma'), data dd/mm] */
export const MURAL_B2C: [string, 'Desempenho' | 'Aviso' | 'Fique por dentro', string, string][] = [
  ['Liberei minha agenda pra você', 'Aviso', 'cm', '29/09'],
  ['Sua nota caiu. Vamos entender o porquê?', 'Desempenho', 'regrediram', '27/09'],
  ['Encontro de outubro: link e tema', 'Aviso', 'turma', '25/09'],
  ['Imunização: o calendário que mais cai', 'Fique por dentro', 'turma', '22/09'],
];

/** state.liberados: aluno → data dd/mm. */
export const AGENDA_LIBERADA_B2C: [string, string][] = [['dp', '18/09'], ['ma', '26/09'], ['hq', '30/09']];

/** LOGS: aluno → [tipo, texto, data dd/mm] */
export const LOGS_B2C: Record<string, [string, string, string][]> = {
  cm: [['agenda_liberada', 'Agendamento liberado + mensagem no mural', '29/09'], ['mural_publicado', 'Mural (pra você) · Sua nota caiu, vamos entender?', '27/09'], ['whatsapp', 'WhatsApp aberto pelo Academy', '22/09']],
  ma: [['intervencao_criada', 'Intervenção: entender por que sumiu', '26/09'], ['agenda_liberada', 'Agendamento liberado + mensagem no mural', '26/09']],
  dp: [['intervencao_criada', 'Reunião individual: replanejar meta', '19/09']],
};

export const CANAIS_B2C = { grupo: 'https://chat.whatsapp.com/Kc8tRbQ2xLm' };
