/**
 * Task 61 — checklist de segurança e LGPD (spec §7.7) transformado em teste
 * automatizado, na medida do que dá para automatizar. O que não dá (RLS em
 * produção, contrato com a IES, retenção, auditoria de acesso nominal) está
 * em `docs/superpowers/checklists/portal-gestor-v2-seguranca.md`.
 *
 * Correção necessária no snippet do plano (`docs/superpowers/plans/2026-07-25-portal-gestor-v2.md`,
 * Task 61): ele importa `./fixturesRegrasCriticas` (entregável da Task 57) e
 * monta o mock em `supabase.rpc`/`AuthContext`, renderizando `VisaoGeral` por
 * cima dos hooks reais. Esse arquivo não existe. Este teste reaproveita o que
 * de fato já existe na árvore: `./fixtures/visaoGeral` (Fase 4) e o padrão de
 * mock usado em `VisaoGeral.test.tsx`/`TabelaAlunos.test.tsx` — que mockam
 * `@/features/gestor/api/queries` (a camada de hooks), não `supabase.rpc`
 * diretamente. Fixture própria em `./fixtures/seguranca.ts`.
 *
 * Achado ao longo do caminho (documentado, não "corrigido" — está fora do
 * escopo desta task mexer em componente): `TabelaAlunos.tsx` guarda
 * `alunoAberto` em `useState` local, não na URL. Isso significa que o dado do
 * aluno HOJE nunca chega na query string (mais estrito que o piso do §7.7,
 * que permitiria um UUID opaco lá) — mas também diverge do que a §8.2 da spec
 * descreve ("aluno aberto" como estado de URL, para o link ser colável). Não
 * é uma violação de segurança; é uma nota para quem for fechar a §8.2.
 */
import * as React from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/utils';
import VisaoGeralRoute from '@/features/gestor/routes/VisaoGeral';
import {
  useAluno,
  useAlunos,
  useDiagnostico,
  useDiagnosticoTemas,
  useGestorContexto,
  useVisaoGeral,
} from '@/features/gestor/api/queries';
import { useFiltrosGestor } from '@/features/gestor/hooks/useFiltrosGestor';
import { metaFake, visaoGeralFake } from './fixtures/visaoGeral';
import { ALUNO_ID, ALUNO_NOME, ALUNO_PROFICIENCIA, alunoDrawerFake, linhaAlunoFake } from './fixtures/seguranca';

vi.mock('@/features/gestor/api/queries', () => ({
  useVisaoGeral: vi.fn(),
  useAlunos: vi.fn(),
  useDiagnostico: vi.fn(),
  useDiagnosticoTemas: vi.fn(),
  useAluno: vi.fn(),
  // Consumido por `AcoesRecorte` (rodapé de `DrawerTemas`): é o servidor que
  // decide `podeExportar`, nunca uma role lida no cliente (mesmo padrão de
  // VisaoGeral.test.tsx).
  useGestorContexto: vi.fn(),
}));

vi.mock('@/features/gestor/hooks/useFiltrosGestor', () => ({
  useFiltrosGestor: vi.fn(),
}));

vi.mock('@/features/gestor/components/FiltroSemestre', () => ({
  FiltroSemestre: () => <div data-testid="filtro-semestre" />,
}));

const mockToast = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const mockUseVisaoGeral = vi.mocked(useVisaoGeral);
const mockUseAlunos = vi.mocked(useAlunos);
const mockUseAluno = vi.mocked(useAluno);
const mockUseFiltrosGestor = vi.mocked(useFiltrosGestor);

const filtrosFake = (overrides: Partial<ReturnType<typeof useFiltrosGestor>> = {}): ReturnType<typeof useFiltrosGestor> => ({
  semestre: '6ano',
  setSemestre: vi.fn(),
  simulados: [],
  setSimulados: vi.fn(),
  iesId: 'ies-1',
  setIesId: vi.fn(),
  ...overrides,
});

/**
 * Varredura estática de `src/features/gestor/**\/*.{ts,tsx}`, excluindo
 * `__tests__` (mesma técnica de `gestorMigrations*.test.ts`, que já lê
 * arquivos de migration do disco neste projeto — `readFileSync`/`readdirSync`
 * funcionam neste ambiente vitest/jsdom).
 */
const RAIZ = resolve(__dirname, '..');
function fontes(dir: string, acc: { p: string; src: string }[] = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') fontes(p, acc);
    } else if (/\.tsx?$/.test(e.name)) {
      acc.push({ p: relative(RAIZ, p), src: readFileSync(p, 'utf-8') });
    }
  }
  return acc;
}
const FONTES = fontes(RAIZ);

/** Busca o conteúdo de um arquivo já lido em `FONTES` por caminho relativo (com `/`, independente do SO). */
function arquivoFonte(caminhoRelativo: string): string {
  const alvo = FONTES.find(({ p }) => p.split(/[\\/]/).join('/') === caminhoRelativo);
  if (!alvo) throw new Error(`fonte não encontrada em FONTES: ${caminhoRelativo}`);
  return alvo.src;
}

beforeEach(() => {
  mockToast.mockClear();

  mockUseFiltrosGestor.mockReturnValue(filtrosFake());

  mockUseVisaoGeral.mockReturnValue({
    data: visaoGeralFake,
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useVisaoGeral>);

  // Uma linha com aluno NOMINAL (nome, id, proficiência distintos) — sem isto,
  // "nada vaza para o storage/URL" seria verdade só porque nada com dado de
  // aluno chegou a renderizar.
  mockUseAlunos.mockReturnValue({
    data: { data: [linhaAlunoFake], page: 1, pageSize: 25, total: 1, totalPages: 1 },
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAlunos>);

  mockUseAluno.mockReturnValue({
    data: alunoDrawerFake,
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAluno>);

  vi.mocked(useGestorContexto).mockReturnValue({
    data: {
      iesAtual: { id: 'ies-1', nome: 'Universidade Teste' },
      iesDisponiveis: [{ id: 'ies-1', nome: 'Universidade Teste' }],
      podeExportar: true,
    },
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useGestorContexto>);

  vi.mocked(useDiagnostico).mockReturnValue({
    data: [],
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useDiagnostico>);

  vi.mocked(useDiagnosticoTemas).mockReturnValue({
    data: [],
    meta: metaFake,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useDiagnosticoTemas>);
});

describe('§7.7 — nenhum payload de aluno em storage', () => {
  it('renderizar a Visão Geral com um aluno nominal na tabela não escreve nome, id nem proficiência do aluno em localStorage nem sessionStorage', async () => {
    const setLocal = vi.spyOn(window.localStorage, 'setItem');
    const setSession = vi.spyOn(window.sessionStorage, 'setItem');

    render(<VisaoGeralRoute />);
    // Prova que o dado nominal esteve de fato na tela — sem isto, a asserção
    // abaixo passaria mesmo que nada tivesse sido renderizado.
    expect(await screen.findByText(ALUNO_NOME)).toBeInTheDocument();

    const escritas = [...setLocal.mock.calls, ...setSession.mock.calls].map(
      ([chave, valor]) => `${String(chave)}=${String(valor)}`,
    );
    escritas.forEach((escrita) => {
      expect(escrita, `escreveu nome de aluno em storage: ${escrita}`).not.toContain(ALUNO_NOME);
      expect(escrita, `escreveu id de aluno em storage: ${escrita}`).not.toContain(ALUNO_ID);
      expect(escrita, `escreveu proficiência de aluno em storage: ${escrita}`).not.toContain(String(ALUNO_PROFICIENCIA));
    });
  });

  it('o código de src/features/gestor não usa localStorage, sessionStorage nem IndexedDB — cache só em memória (React Query)', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} usa localStorage — proibido (§7.7)`).not.toMatch(/\blocalStorage\b/);
      expect(src, `${p} usa sessionStorage — proibido (§7.7)`).not.toMatch(/\bsessionStorage\b/);
      expect(src, `${p} usa IndexedDB — proibido (§7.7)`).not.toMatch(/indexedDB/i);
    });
  });

  it('React Query do portal não é persistido em disco', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} importa persistQueryClient/createSyncStoragePersister`).not.toMatch(
        /persistQueryClient|createSyncStoragePersister/,
      );
    });
  });
});

describe('§7.7 — nenhum HTML injetado', () => {
  it('nenhum arquivo de src/features/gestor usa dangerouslySetInnerHTML', () => {
    const infratores = FONTES.filter(({ src }) => src.includes('dangerouslySetInnerHTML')).map(({ p }) => p);
    expect(infratores, `texto vindo da API é sempre texto (§7.7): ${infratores.join(', ')}`).toEqual([]);
  });

  it('nem innerHTML de escrita, insertAdjacentHTML ou document.write', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} usa innerHTML`).not.toMatch(/\.innerHTML\s*=/);
      expect(src, `${p} usa insertAdjacentHTML`).not.toMatch(/insertAdjacentHTML/);
      expect(src, `${p} usa document.write`).not.toMatch(/document\.write/);
    });
  });
});

describe('§7.7 — nenhum dado pessoal de aluno na URL/query string', () => {
  it('abrir o DrawerAluno não expõe nome nem id do aluno na URL', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const urlAntes = window.location.href;

    render(<VisaoGeralRoute />);
    await user.click(await screen.findByRole('button', { name: ALUNO_NOME }));

    // Confirma que o drawer que abriu É o do aluno certo (não um diálogo vazio).
    expect(await screen.findByRole('dialog')).toHaveAccessibleName(new RegExp(ALUNO_NOME));
    expect(mockUseAluno).toHaveBeenLastCalledWith(ALUNO_ID, ['s1', 's2', 's3']);

    // Hoje `TabelaAlunos` guarda `alunoAberto` em `useState` local — abrir o
    // drawer não toca a URL (mais estrito que o piso do §7.7, que aceitaria
    // um UUID opaco ali). Fixamos o comportamento atual; se “aluno aberto”
    // virar estado de URL (§8.2), o requisito que sobrevive é o de baixo:
    // nunca nome, e-mail, CPF ou matrícula na query string.
    expect(window.location.href).toBe(urlAntes);
    expect(window.location.href).not.toContain(ALUNO_NOME);
    expect(window.location.search).not.toContain(ALUNO_ID);
  });

  it('nenhum código do portal monta URL/query param com email, cpf ou matrícula', () => {
    FONTES.forEach(({ p, src }) => {
      expect(src, `${p} coloca e-mail/cpf/matrícula em query param`).not.toMatch(/[?&](email|e_mail|cpf|matricula)=/i);
      expect(src, `${p} usa searchParams.set com chave identificável`).not.toMatch(
        /\.set\(\s*['"](email|cpf|matricula|nome)['"]/i,
      );
    });
  });

  it('useFiltrosGestor só expõe chaves de recorte (semestre, simulados, ies) na URL — nenhuma chave de identidade de aluno', () => {
    const src = arquivoFonte('hooks/useFiltrosGestor.ts');
    const chaveMatch = src.match(/const CHAVE = \{([^}]*)\}/);
    expect(
      chaveMatch,
      'useFiltrosGestor.ts não declara mais o objeto CHAVE do jeito esperado — revisar este teste junto da mudança',
    ).not.toBeNull();
    const valores = [...(chaveMatch?.[1].matchAll(/'([^']+)'/g) ?? [])].map((m) => m[1]);
    expect(new Set(valores)).toEqual(new Set(['semestre', 'simulados', 'ies']));
  });
});

describe('§7.7 — export e cópia de resumo', () => {
  it('nenhum caminho de export (Xlsx/Csv/Pdf/Planilha) é chamado sem escopo explícito', () => {
    FONTES.filter(({ src }) => /export(ar)?(Xlsx|Csv|Pdf|Planilha)/i.test(src)).forEach(({ p, src }) => {
      expect(src, `${p} exporta sem recorte — §7.7 exige recorte, nunca a base inteira`).not.toMatch(
        /exportar\w*\(\s*\)/,
      );
    });
  });

  it('"Copiar resumo" (AcoesRecorte) nunca escreve `.nome` de um item de lista dentro da chamada ao clipboard', () => {
    const infratores = FONTES.filter(
      ({ src }) => src.includes('clipboard') && /writeText\([^)]*\.nome/.test(src),
    ).map(({ p }) => p);
    expect(infratores, `§7.7: "Copiar resumo" nunca copia lista nominal: ${infratores.join(', ')}`).toEqual([]);
  });

  it('a assinatura de AcoesRecorte é a barreira: recebe texto agregado (resumoTexto: string), nunca uma lista de alunos', () => {
    const src = arquivoFonte('components/AcoesRecorte.tsx');
    expect(src).toMatch(/resumoTexto:\s*string/);
    expect(src).not.toMatch(/alunos\s*:\s*\w*\[\]/i);
  });
});

describe('§7.7 — telemetria (se existir) não carrega PII', () => {
  /**
   * Hoje `src/features/gestor` não chama nenhum tracker de analytics (nem
   * `useAnalyticsTracker`, nem `posthog`, nem `Logger.*` com dado de aluno) —
   * ver checklist. Estes dois testes são guarda de regressão para quando a
   * Task 63 (ou outra) instrumentar `gestor_tela_vista`/`gestor_drawer_aberto`
   * etc.: qualquer propriedade parecida com nome/e-mail/cpf/matrícula perto de
   * uma chamada de log ou telemetria falha a suíte.
   */
  it('nenhuma chamada a Logger.* loga nome, e-mail, cpf ou matrícula de aluno', () => {
    FONTES.forEach(({ p, src }) => {
      for (const m of src.matchAll(/Logger\.(?:info|warn|error)\(/g)) {
        const inicio = m.index ?? 0;
        const janela = src.slice(inicio, inicio + 400);
        expect(
          janela,
          `${p} loga possível PII perto de "${m[0]}": ${janela.slice(0, 160)}`,
        ).not.toMatch(/\b(nome|email|e_mail|cpf|matricula)\b\s*[:.]/i);
      }
    });
  });

  it('nenhuma chamada a tracker de analytics carrega nome, e-mail ou matrícula de aluno como propriedade', () => {
    FONTES.forEach(({ p, src }) => {
      for (const m of src.matchAll(/\b(?:useAnalyticsTracker|trackEvent|posthog\.capture)\s*\(/g)) {
        const inicio = m.index ?? 0;
        const janela = src.slice(inicio, inicio + 400);
        expect(
          janela,
          `${p} manda possível PII para telemetria perto de "${m[0]}": ${janela.slice(0, 160)}`,
        ).not.toMatch(/\b(nome|email|e_mail|cpf|matricula|alunoNome)\b\s*[:.]/i);
      }
    });
  });
});
