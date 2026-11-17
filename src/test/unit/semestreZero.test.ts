import { describe, it, expect } from 'vitest';
import { createUserSchema } from '@/utils/validation';

const base = { nome: 'Prof Teste', email: 'p@x.com', id_ies: '00000000-0000-4000-8000-000000000000' };

describe('semestre aceita 0 a 12', () => {
  it('aceita semestre 0 (professores, gestores, time interno)', () => {
    expect(createUserSchema.safeParse({ ...base, semestre: 0 }).success).toBe(true);
  });
  it('aceita 12', () => {
    expect(createUserSchema.safeParse({ ...base, semestre: 12 }).success).toBe(true);
  });
  it('recusa -1 e 13', () => {
    expect(createUserSchema.safeParse({ ...base, semestre: -1 }).success).toBe(false);
    expect(createUserSchema.safeParse({ ...base, semestre: 13 }).success).toBe(false);
  });
});
