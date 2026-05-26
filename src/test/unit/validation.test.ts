import { describe, it, expect } from 'vitest';
import { changePasswordSchema } from '@/utils/validation';

describe('utils/validation — changePasswordSchema', () => {
  // Regressão crítica: o regex anterior (sem {8,}) rejeitava TODA senha
  // válida porque casava apenas 1 caractere após os lookaheads.
  it('aceita senha válida de 12 caracteres com requisitos completos', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Abc123!Def456',
      confirmPassword: 'Abc123!Def456',
    });
    expect(result.success).toBe(true);
  });

  it('aceita senha com exatamente 8 caracteres atendendo requisitos', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Aa1!aaaa',
      confirmPassword: 'Aa1!aaaa',
    });
    expect(result.success).toBe(true);
  });

  it('rejeita senha sem letra maiúscula', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'abc123!def',
      confirmPassword: 'abc123!def',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senha sem letra minúscula', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'ABC123!DEF',
      confirmPassword: 'ABC123!DEF',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senha sem dígito', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Abcdefg!Hij',
      confirmPassword: 'Abcdefg!Hij',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senha sem caractere especial', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Abc123Def456',
      confirmPassword: 'Abc123Def456',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Aa1!aa',
      confirmPassword: 'Aa1!aa',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita quando senhas não coincidem', () => {
    const result = changePasswordSchema.safeParse({
      newPassword: 'Abc123!Def',
      confirmPassword: 'Different1!',
    });
    expect(result.success).toBe(false);
  });
});
