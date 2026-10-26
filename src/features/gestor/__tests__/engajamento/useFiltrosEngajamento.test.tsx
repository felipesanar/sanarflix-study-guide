import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as React from 'react';
import { renderHook, act, screen } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));

import { useFiltrosEngajamento, queryParaAba } from '@/features/gestor/hooks/useFiltrosEngajamento';

/** Spec 2026-10-22-engajamento §9.6 (regras 1–8) e §10.3. */

const Sonda = () => {
  const { pathname, search } = useLocation();
  const tipoNavegacao = useNavigationType();
  return (
    <>
      <span data-testid="path">{pathname}</span>
      <span data-testid="search">{search}</span>
      <span data-testid="navtype">{tipoNavegacao}</span>
    </>
  );
};

const comUrl = (url: string) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      {children}
      <Sonda />
    </MemoryRouter>
  );
  return renderHook(() => useFiltrosEngajamento(), { wrapper });
};

const params = () => new URLSearchParams(screen.getByTestId('search').textContent ?? '');

describe('useFiltrosEngajamento (spec §9.6)', () => {
  beforeEach(() => {
    // Fixa "hoje" em 22/10/2026 (15:00 UTC = 12:00 em São Paulo) sem travar os timers do React.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  describe('leitura da URL', () => {
    it('sem nada na URL: padrões 6m, todos os semestres, sem aluno, tipo "todos"', () => {
      const { result } = comUrl('/gestor/engajamento');
      expect(result.current.iesId).toBeNull();
      expect(result.current.periodo).toBe('6m');
      expect(result.current.de).toBeNull();
      expect(result.current.ate).toBeNull();
      expect(result.current.inicio).toBe('2026-05-01');
      expect(result.current.fim).toBe('2026-10-22');
      expect(result.current.semestre).toBeNull();
      expect(result.current.alunoId).toBeNull();
      expect(result.current.tipo).toBe('todos');
    });

    it('lê todas as chaves de uma URL preexistente', () => {
      const { result } = comUrl(
        '/gestor/engajamento/conteudos?ies=ies-9&periodo=30d&eng_sem=8&tipo=video',
      );
      expect(result.current.iesId).toBe('ies-9');
      expect(result.current.periodo).toBe('30d');
      expect(result.current.inicio).toBe('2026-09-23');
      expect(result.current.fim).toBe('2026-10-22');
      expect(result.current.semestre).toBe(8);
      expect(result.current.tipo).toBe('video');
    });

    it('lê o aluno e o período personalizado', () => {
      const { result } = comUrl('/gestor/engajamento?aluno=abc123&periodo=custom&de=2026-03-01&ate=2026-04-15');
      expect(result.current.alunoId).toBe('abc123');
      expect(result.current.periodo).toBe('custom');
      expect(result.current.de).toBe('2026-03-01');
      expect(result.current.ate).toBe('2026-04-15');
      expect(result.current.inicio).toBe('2026-03-01');
      expect(result.current.fim).toBe('2026-04-15');
    });

    it('"letivo" vai do 1º dia do semestre letivo até hoje', () => {
      const { result } = comUrl('/gestor/engajamento?periodo=letivo');
      expect(result.current.periodo).toBe('letivo');
      expect(result.current.inicio).toBe('2026-07-01');
    });
  });

  describe('regra 6: valor inválido cai no padrão, sem erro', () => {
    it('periodo desconhecido → 6m', () => {
      const { result } = comUrl('/gestor/engajamento?periodo=ontem');
      expect(result.current.periodo).toBe('6m');
      expect(result.current.inicio).toBe('2026-05-01');
    });

    it('custom sem datas válidas → 6m, e de/ate saem nulos', () => {
      for (const url of [
        '/gestor/engajamento?periodo=custom',
        '/gestor/engajamento?periodo=custom&de=2026-05-10&ate=2026-05-01',
        '/gestor/engajamento?periodo=custom&de=2024-01-01&ate=2024-02-01',
        '/gestor/engajamento?periodo=custom&de=2026-02-30&ate=2026-03-10',
      ]) {
        const { result } = comUrl(url);
        expect(result.current.periodo, url).toBe('6m');
        expect(result.current.de, url).toBeNull();
        expect(result.current.ate, url).toBeNull();
        expect(result.current.inicio, url).toBe('2026-05-01');
      }
    });

    it('eng_sem fora de 1–12 (ou não inteiro) → todos', () => {
      for (const valor of ['0', '13', '-1', 'abc', '8.5', '']) {
        const { result } = comUrl(`/gestor/engajamento?eng_sem=${valor}`);
        expect(result.current.semestre, `eng_sem=${valor}`).toBeNull();
      }
      expect(comUrl('/gestor/engajamento?eng_sem=1').result.current.semestre).toBe(1);
      expect(comUrl('/gestor/engajamento?eng_sem=12').result.current.semestre).toBe(12);
    });

    it('tipo desconhecido → todos', () => {
      const { result } = comUrl('/gestor/engajamento/conteudos?tipo=audio');
      expect(result.current.tipo).toBe('todos');
    });
  });

  describe('regra 1: aluno e semestre são mutuamente exclusivos', () => {
    it('setAluno grava aluno e apaga eng_sem', () => {
      const { result } = comUrl('/gestor/engajamento?eng_sem=8');
      act(() => result.current.setAluno('aluno-7'));
      expect(params().get('aluno')).toBe('aluno-7');
      expect(params().has('eng_sem')).toBe(false);
      expect(result.current.alunoId).toBe('aluno-7');
      expect(result.current.semestre).toBeNull();
    });

    it('setSemestre grava eng_sem e apaga aluno', () => {
      const { result } = comUrl('/gestor/engajamento?aluno=aluno-7');
      act(() => result.current.setSemestre(8));
      expect(params().get('eng_sem')).toBe('8');
      expect(params().has('aluno')).toBe(false);
      expect(result.current.semestre).toBe(8);
      expect(result.current.alunoId).toBeNull();
    });

    it('setSemestre(null) remove só o eng_sem (não há semestre escrito, então nada troca o aluno)', () => {
      const { result } = comUrl('/gestor/engajamento?eng_sem=8');
      act(() => result.current.setSemestre(null));
      expect(params().has('eng_sem')).toBe(false);
      expect(result.current.semestre).toBeNull();

      const comAluno = comUrl('/gestor/engajamento?aluno=aluno-7');
      act(() => comAluno.result.current.setSemestre(null));
      expect(comAluno.result.current.alunoId).toBe('aluno-7');
    });

    it('setSemestre com valor fora de 1–12 é tratado como "todos"', () => {
      const { result } = comUrl('/gestor/engajamento?eng_sem=5');
      act(() => result.current.setSemestre(13));
      expect(params().has('eng_sem')).toBe(false);
      expect(result.current.semestre).toBeNull();
    });

    it('setAluno(null) remove o aluno e não mexe no semestre', () => {
      const { result } = comUrl('/gestor/engajamento?aluno=aluno-7');
      act(() => result.current.setAluno(null));
      expect(params().has('aluno')).toBe(false);
      expect(result.current.alunoId).toBeNull();
    });
  });

  describe('regras 2 e 3: o mesmo botão liga e desliga', () => {
    it('clicar de novo no semestre selecionado limpa a chave (toggle feito pelo chamador com setSemestre)', () => {
      const { result } = comUrl('/gestor/engajamento?eng_sem=8');
      const alternar = (n: number) => result.current.setSemestre(result.current.semestre === n ? null : n);
      act(() => alternar(8));
      expect(result.current.semestre).toBeNull();
      expect(params().has('eng_sem')).toBe(false);
      act(() => alternar(8));
      expect(result.current.semestre).toBe(8);
    });

    it('clicar de novo no aluno já selecionado limpa o aluno', () => {
      const { result } = comUrl('/gestor/engajamento?aluno=aluno-7');
      const alternar = (id: string) => result.current.setAluno(result.current.alunoId === id ? null : id);
      act(() => alternar('aluno-7'));
      expect(result.current.alunoId).toBeNull();
      act(() => alternar('aluno-7'));
      expect(result.current.alunoId).toBe('aluno-7');
    });
  });

  describe('regra 4: o "×" da faixa limpa aluno e semestre', () => {
    it('limparFiltroPagina apaga aluno e eng_sem, e preserva o resto', () => {
      const { result } = comUrl('/gestor/engajamento?ies=ies-1&periodo=30d&aluno=aluno-7&eng_sem=8');
      act(() => result.current.limparFiltroPagina());
      expect(params().has('aluno')).toBe(false);
      expect(params().has('eng_sem')).toBe(false);
      expect(params().get('ies')).toBe('ies-1');
      expect(params().get('periodo')).toBe('30d');
    });
  });

  describe('regra 5: links das abas', () => {
    it('Questões e Conteúdos removem aluno e mantêm período, semestre, ies e o resto da query', () => {
      const origem = '?ies=ies-1&periodo=custom&de=2026-03-01&ate=2026-04-15&eng_sem=8&aluno=aluno-7&semestre=geral';
      for (const aba of ['questoes', 'conteudos'] as const) {
        const destino = new URLSearchParams(queryParaAba(origem, aba));
        expect(destino.has('aluno'), aba).toBe(false);
        expect(destino.get('ies'), aba).toBe('ies-1');
        expect(destino.get('periodo'), aba).toBe('custom');
        expect(destino.get('de'), aba).toBe('2026-03-01');
        expect(destino.get('ate'), aba).toBe('2026-04-15');
        expect(destino.get('eng_sem'), aba).toBe('8');
        // chaves de outras telas do portal sobrevivem (a sidebar também as preserva)
        expect(destino.get('semestre'), aba).toBe('geral');
      }
    });

    it('o link de volta para a Visão geral mantém tudo, menos tipo', () => {
      const destino = new URLSearchParams(
        queryParaAba('?ies=ies-1&periodo=30d&eng_sem=8&tipo=video', 'visao-geral'),
      );
      expect(destino.has('tipo')).toBe(false);
      expect(destino.get('ies')).toBe('ies-1');
      expect(destino.get('periodo')).toBe('30d');
      expect(destino.get('eng_sem')).toBe('8');
    });

    it('devolve string vazia quando não sobra nada, e aceita URLSearchParams', () => {
      expect(queryParaAba('?aluno=aluno-7', 'questoes')).toBe('');
      expect(queryParaAba('', 'conteudos')).toBe('');
      expect(queryParaAba(new URLSearchParams('periodo=30d&aluno=a'), 'questoes')).toBe('?periodo=30d');
    });
  });

  describe('regra 7: toda escrita usa replace', () => {
    it.each([
      ['setPeriodo', (r: ReturnType<typeof useFiltrosEngajamento>) => r.setPeriodo('30d')],
      ['setSemestre', (r: ReturnType<typeof useFiltrosEngajamento>) => r.setSemestre(8)],
      ['setAluno', (r: ReturnType<typeof useFiltrosEngajamento>) => r.setAluno('aluno-7')],
      ['setTipo', (r: ReturnType<typeof useFiltrosEngajamento>) => r.setTipo('video')],
      ['limparFiltroPagina', (r: ReturnType<typeof useFiltrosEngajamento>) => r.limparFiltroPagina()],
    ])('%s não empilha entrada de histórico', (_nome, escrever) => {
      const { result } = comUrl('/gestor/engajamento?aluno=x');
      act(() => escrever(result.current));
      expect(screen.getByTestId('navtype').textContent).toBe('REPLACE');
    });
  });

  describe('setPeriodo e setTipo', () => {
    it('setPeriodo("30d") grava periodo, remove de/ate e recalcula inicio/fim', () => {
      const { result } = comUrl('/gestor/engajamento?periodo=custom&de=2026-03-01&ate=2026-04-15');
      act(() => result.current.setPeriodo('30d'));
      expect(params().get('periodo')).toBe('30d');
      expect(params().has('de')).toBe(false);
      expect(params().has('ate')).toBe(false);
      expect(result.current.inicio).toBe('2026-09-23');
      expect(result.current.fim).toBe('2026-10-22');
      expect(result.current.de).toBeNull();
    });

    it('setPeriodo("custom", de, ate) grava as três chaves', () => {
      const { result } = comUrl('/gestor/engajamento');
      act(() => result.current.setPeriodo('custom', '2026-02-01', '2026-02-28'));
      expect(params().get('periodo')).toBe('custom');
      expect(params().get('de')).toBe('2026-02-01');
      expect(params().get('ate')).toBe('2026-02-28');
      expect(result.current.inicio).toBe('2026-02-01');
      expect(result.current.fim).toBe('2026-02-28');
    });

    it('setPeriodo("custom") inválido degrada para 6m na leitura', () => {
      const { result } = comUrl('/gestor/engajamento');
      act(() => result.current.setPeriodo('custom', '2026-05-10', '2026-05-01'));
      expect(result.current.periodo).toBe('6m');
      expect(result.current.inicio).toBe('2026-05-01');
    });

    it('setTipo grava tipo', () => {
      const { result } = comUrl('/gestor/engajamento/conteudos');
      act(() => result.current.setTipo('document'));
      expect(params().get('tipo')).toBe('document');
      expect(result.current.tipo).toBe('document');
      act(() => result.current.setTipo('todos'));
      expect(result.current.tipo).toBe('todos');
    });
  });

  describe('escritas no mesmo tick', () => {
    it('duas escritas antes do re-render não se sobrescrevem', () => {
      const { result } = comUrl('/gestor/engajamento?ies=ies-1');
      act(() => {
        result.current.setPeriodo('30d');
        result.current.setTipo('video');
        result.current.setSemestre(5);
      });
      expect(params().get('periodo')).toBe('30d');
      expect(params().get('tipo')).toBe('video');
      expect(params().get('eng_sem')).toBe('5');
      expect(params().get('ies')).toBe('ies-1');
    });
  });
});
