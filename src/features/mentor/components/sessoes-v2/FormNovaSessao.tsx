import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Icon } from '@/features/gestor/components/Icon';
import { campoDoErro, mensagemErro, tratamentoErro } from '../../api/erros';
import type { AlunoFlix } from '../../api/fonte';
import { useCriarSessao } from '../../api/queries';
import type { Sessao, TipoSessao } from '../../api/types';
import { avisoContrato, ehColetiva, lerData, lerHora, montarInicio, normalizarLink } from './util';
import { ERRO_LINK_MEET } from './EditoresSessao';

export const ERRO_ALUNO = 'Escolha o aluno da sessão.';

interface Comum {
  alunos: AlunoFlix[] | undefined;
  onCancelar: () => void;
  /** Sessão criada (com a mensagem de toast pronta). */
  onSalva: (sessao: Sessao, toast: string) => void;
  onToast: (msg: string) => void;
}

function SelectAluno({ alunos, valor, onChange, invalido, descricao, className }: {
  alunos: AlunoFlix[] | undefined; valor: string; onChange: (v: string) => void; invalido: boolean; descricao?: string; className: string;
}) {
  const ordenados = [...(alunos ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return (
    <select
      className={`ms-input ${className}`}
      aria-label="Aluno"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalido || undefined}
      aria-describedby={descricao}
      disabled={!alunos}
    >
      <option value="">{alunos ? 'Aluno' : 'Carregando alunos…'}</option>
      {ordenados.map((a) => <option key={a.alunoId} value={a.alunoId}>{a.nome}</option>)}
    </select>
  );
}

type Campo = 'tipo' | 'aluno' | 'data' | 'hora' | 'tema' | 'link';
/** Campo da API (`field` do erro de validação) → campo do formulário. */
const CAMPO_API: Record<string, Campo> = { inicio: 'data', data: 'data', hora: 'hora', tema: 'tema', meetUrl: 'link', link: 'link', alunoId: 'aluno', aluno: 'aluno', tipo: 'tipo' };

function useFoco<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return ref;
}

// ─── B2C ────────────────────────────────────────────────────────────────────

const TIPOS_B2C: { valor: 'encontro_tribo' | 'individual'; rotulo: string }[] = [
  { valor: 'encontro_tribo', rotulo: 'Encontro da tribo' },
  { valor: 'individual', rotulo: 'Individual' },
];

/** Formulário inline do B2C (docs/02 § Tela 5): tema obrigatório; encontro sem link fica "Falta link". */
export function FormNovaSessaoB2c({ alunos, onCancelar, onSalva, onToast, tipoInicial }: Comum & { tipoInicial?: 'encontro_tribo' | 'individual' }) {
  const criar = useCriarSessao();
  const [tipo, setTipo] = useState<'encontro_tribo' | 'individual'>(tipoInicial ?? 'encontro_tribo');
  const [aluno, setAluno] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [tema, setTema] = useState('');
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<{ texto: string; campos: Campo[] } | null>(null);
  const dicaId = useId();
  const primeiro = useFoco<HTMLButtonElement>();
  const individual = tipo === 'individual';
  const inval = (c: Campo) => !!erro?.campos.includes(c);
  const desc = (c: Campo) => (inval(c) ? dicaId : undefined);

  async function salvar() {
    const dataIso = lerData(data);
    const faltando: Campo[] = [...(dataIso ? [] : ['data' as const]), ...(tema.trim() ? [] : ['tema' as const])];
    if (faltando.length) return setErro({ texto: 'Preencha data e tema.', campos: faltando });
    // Sem hora, vale a do placeholder (19h), como o encontro mensal da tribo.
    const horaOk = hora.trim() ? lerHora(hora) : '19:00';
    if (!horaOk) return setErro({ texto: 'Informe a hora como 19h ou 19:30.', campos: ['hora'] });
    if (individual && !aluno) return setErro({ texto: ERRO_ALUNO, campos: ['aluno'] });
    const meetUrl = !individual && link.trim() ? normalizarLink(link) : null;
    if (!individual && link.trim() && !meetUrl) return setErro({ texto: ERRO_LINK_MEET, campos: ['link'] });
    const alunoNome = individual ? alunos?.find((a) => a.alunoId === aluno)?.nome : undefined;
    try {
      const criada = await criar.mutateAsync({
        sessao: { tipo, inicio: montarInicio(dataIso!, horaOk), tema: tema.trim(), alunoId: individual ? aluno : null, meetUrl },
        alunoNome,
      });
      onSalva(criada, individual ? 'Sessão salva · Reunião individual em A fazer' : 'Encontro salvo · aviso publicado no mural da tribo');
    } catch (e) {
      if (tratamentoErro(e) === 'toast') onToast(mensagemErro(e));
      const campo = CAMPO_API[campoDoErro(e) ?? ''];
      setErro({ texto: mensagemErro(e), campos: campo ? [campo] : [] });
    }
  }

  const limpa = (f: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => { f(e.target.value); setErro(null); };
  return (
    <form className="ms-form-b2c" aria-label="Nova sessão" noValidate onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <div className="ms-seg" role="group" aria-label="Tipo de sessão">
        {TIPOS_B2C.map((t, i) => (
          <button key={t.valor} ref={i === 0 ? primeiro : undefined} type="button" aria-pressed={tipo === t.valor}
            onClick={() => { setTipo(t.valor); setErro(null); }}>
            {t.rotulo}
          </button>
        ))}
      </div>
      {individual && <SelectAluno alunos={alunos} valor={aluno} onChange={(v) => { setAluno(v); setErro(null); }} invalido={inval('aluno')} descricao={desc('aluno')} className="ms-campo-aluno" />}
      <input className="ms-input ms-campo-data" value={data} onChange={limpa(setData)} placeholder="dd/mm" aria-label="Data" inputMode="numeric" aria-invalid={inval('data') || undefined} aria-describedby={desc('data')} />
      <input className="ms-input ms-campo-hora" value={hora} onChange={limpa(setHora)} placeholder="19h" aria-label="Hora" aria-invalid={inval('hora') || undefined} aria-describedby={desc('hora')} />
      <input className="ms-input ms-campo-tema" value={tema} onChange={limpa(setTema)} placeholder="Tema" aria-label="Tema" aria-required="true" aria-invalid={inval('tema') || undefined} aria-describedby={desc('tema')} />
      {!individual && <input className="ms-input ms-campo-link" value={link} onChange={limpa(setLink)} placeholder="Link do Meet (pode ficar pra depois)" aria-label="Link" aria-invalid={inval('link') || undefined} aria-describedby={desc('link')} />}
      <button type="button" className="ms-btn-texto" onClick={onCancelar}>Cancelar</button>
      <button type="submit" className="ms-btn-salvar" disabled={criar.isPending} aria-busy={criar.isPending || undefined}>Salvar</button>
      <span id={dicaId} className="ms-dica" data-erro={erro ? 'true' : undefined} aria-live="polite">
        {erro?.texto ?? (individual
          ? 'Individual entra no kanban como Reunião individual.'
          : 'Encontro da tribo avisa a turma no mural. Sem link, fica marcado "Falta link".')}
      </span>
    </form>
  );
}

// ─── B2B ────────────────────────────────────────────────────────────────────

type TipoB2b = Extract<TipoSessao, 'pos_simulado' | 'oficina' | 'individual'>;
const TIPOS_B2B: { valor: TipoB2b; rotulo: string; desc: string }[] = [
  { valor: 'pos_simulado', rotulo: 'Pós-simulado', desc: 'Discussão dos temas mais críticos do simulado. Pauta sugerida: as 20 mais erradas e os distratores.' },
  { valor: 'oficina', rotulo: 'Oficina de questões', desc: 'Prática ativa: 5 questões pré-teste → comentário → ficha resumo → 5 pós-aula. Alunos votam a alternativa no chat.' },
  { valor: 'individual', rotulo: 'Individual', desc: 'Reunião com um aluno. Entra no kanban como Reunião individual.' },
];

/** Formulário do B2B (docs/03 § Tela 4): data obrigatória; aviso de contrato não bloqueia. */
export function FormNovaSessaoB2b({ alunos, onCancelar, onSalva, onToast, sessoes, encontrosPorMes, iesNome, tipoInicial }: Comum & {
  sessoes: Sessao[]; encontrosPorMes: number | null | undefined; iesNome: string | null | undefined; tipoInicial?: TipoB2b;
}) {
  const criar = useCriarSessao();
  const [tipo, setTipo] = useState<TipoB2b>(tipoInicial ?? 'pos_simulado');
  const [aluno, setAluno] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('20h');
  const [tema, setTema] = useState('');
  const [link, setLink] = useState('');
  const [erro, setErro] = useState<{ texto: string; campos: Campo[] } | null>(null);
  const erroId = useId();
  const primeiro = useFoco<HTMLButtonElement>();
  const individual = tipo === 'individual';
  const atual = TIPOS_B2B.find((t) => t.valor === tipo)!;
  const aviso = ehColetiva(tipo) ? avisoContrato(sessoes, lerData(data), encontrosPorMes, iesNome) : null;
  const inval = (c: Campo) => !!erro?.campos.includes(c);
  const desc = (c: Campo) => (inval(c) ? erroId : undefined);

  async function salvar() {
    const dataIso = lerData(data);
    if (!dataIso) return setErro({ texto: 'Informe a data da sessão.', campos: ['data'] });
    const horaOk = lerHora(hora.trim() || '20h');
    if (!horaOk) return setErro({ texto: 'Informe a hora como 20h ou 20:30.', campos: ['hora'] });
    if (individual && !aluno) return setErro({ texto: ERRO_ALUNO, campos: ['aluno'] });
    const meetUrl = !individual && link.trim() ? normalizarLink(link) : null;
    if (!individual && link.trim() && !meetUrl) return setErro({ texto: ERRO_LINK_MEET, campos: ['link'] });
    const alunoNome = individual ? alunos?.find((a) => a.alunoId === aluno)?.nome : undefined;
    try {
      const criada = await criar.mutateAsync({
        sessao: { tipo, inicio: montarInicio(dataIso, horaOk), tema: tema.trim() || null, alunoId: individual ? aluno : null, meetUrl },
        alunoNome,
      });
      const acima = criada.warnings?.includes('acima_do_contrato') ? ' · acima do contrato, não conta no ciclo' : '';
      onSalva(criada, individual ? 'Sessão salva · Reunião individual em A fazer' : `Sessão salva${meetUrl ? ' · turma avisada no mural' : ' · falta o link do Meet'}${acima}`);
    } catch (e) {
      if (tratamentoErro(e) === 'toast') onToast(mensagemErro(e));
      const campo = CAMPO_API[campoDoErro(e) ?? ''];
      setErro({ texto: mensagemErro(e), campos: campo ? [campo] : [] });
    }
  }

  const limpa = (f: (v: string) => void) => (e: ChangeEvent<HTMLInputElement>) => { f(e.target.value); setErro(null); };
  return (
    <form className="ms-form-b2b" aria-label="Nova sessão" noValidate onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
      <div className="ms-seg" role="group" aria-label="Tipo de sessão">
        {TIPOS_B2B.map((t, i) => (
          <button key={t.valor} ref={i === 0 ? primeiro : undefined} type="button" aria-pressed={tipo === t.valor}
            onClick={() => { setTipo(t.valor); setErro(null); }}>
            {t.rotulo}
          </button>
        ))}
      </div>
      <span className="ms-desc">{atual.desc}</span>
      <div className="ms-campos">
        {individual && <SelectAluno alunos={alunos} valor={aluno} onChange={(v) => { setAluno(v); setErro(null); }} invalido={inval('aluno')} descricao={desc('aluno')} className="ms-campo-aluno" />}
        <input className="ms-input ms-campo-data" value={data} onChange={limpa(setData)} placeholder="Data (dd/mm)" aria-label="Data" inputMode="numeric" aria-required="true" aria-invalid={inval('data') || undefined} aria-describedby={desc('data')} />
        <input className="ms-input ms-campo-hora" value={hora} onChange={limpa(setHora)} placeholder="20h" aria-label="Hora" aria-invalid={inval('hora') || undefined} aria-describedby={desc('hora')} />
        <input className="ms-input ms-campo-tema" value={tema} onChange={limpa(setTema)} placeholder="Tema ou pauta" aria-label="Tema" aria-invalid={inval('tema') || undefined} aria-describedby={desc('tema')} />
        {!individual && <input className="ms-input ms-campo-link" value={link} onChange={limpa(setLink)} placeholder="Link do Meet (pode ficar pra depois)" aria-label="Link" aria-invalid={inval('link') || undefined} aria-describedby={desc('link')} />}
      </div>
      {aviso && <span className="ms-aviso" data-testid="aviso-contrato"><Icon name="report_problem" size={14} />{aviso}</span>}
      {erro && <span id={erroId} className="ms-erro" role="alert">{erro.texto}</span>}
      <div className="ms-acoes">
        <button type="button" className="ms-btn-texto" onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="ms-btn-salvar" disabled={criar.isPending} aria-busy={criar.isPending || undefined}>Salvar sessão</button>
      </div>
    </form>
  );
}
