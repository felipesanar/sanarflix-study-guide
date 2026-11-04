import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FaixaContexto } from '@/features/mentor/components/FaixaContexto';
import { temaTribo, temaIes } from '@/features/mentor/tema/contexto';

describe('FaixaContexto', () => {
  it.each([[9, 'Bom dia'], [12, 'Boa tarde'], [18, 'Boa noite']] as const)('saúda às %s e aciona callbacks', (h, saudacao) => {
    const primaria = vi.fn(), secundaria = vi.fn();
    render(<FaixaContexto tema={temaTribo('carcara')} primeiroNome="Thiago" eyebrow="Tribo Carcará · Nota 90+" marca={<img src="/tribo.svg" alt="Tribo Carcará" />} agora={new Date(2026, 10, 4, h)} acaoPrimaria={{ rotulo: 'Nova sessão', icone: 'add', onClick: primaria }} acaoSecundaria={{ rotulo: 'Ver minha turma', icone: 'groups', onClick: secundaria }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`${saudacao}, Thiago`);
    expect(screen.getByRole('img', { name: 'Tribo Carcará' })).toBeVisible();
    expect(screen.getByRole('banner')).toHaveClass('max-[599px]:flex-col');
    fireEvent.click(screen.getByRole('button', { name: 'Nova sessão' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha turma' }));
    expect(primaria).toHaveBeenCalledOnce();
    expect(secundaria).toHaveBeenCalledOnce();
  });
  it('IES sem nome ou marca não inventa conteúdo e usa texto legível no fallback claro', () => {
    render(<FaixaContexto tema={temaIes()} primeiroNome="" marca={null} agora={new Date(2026, 10, 4, 12)} acaoPrimaria={{ rotulo: 'Nova sessão', icone: 'add', onClick: vi.fn() }} acaoSecundaria={{ rotulo: 'Visão geral', icone: 'equalizer', onClick: vi.fn() }} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Boa tarde, —');
    expect(screen.getByRole('heading', { level: 1 }).style.color).not.toBe('rgb(255, 255, 255)');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
