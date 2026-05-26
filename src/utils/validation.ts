import { z } from 'zod';

/**
 * Esquemas de validação usando Zod para garantir integridade dos dados
 */

// Schema para validação de usuário
export const userSchema = z.object({
  id: z.string().uuid('ID deve ser um UUID válido'),
  email: z.string().email('Email deve ter um formato válido'),
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, 'Nome deve conter apenas letras e espaços'),
  id_ies: z.string().uuid('ID da IES deve ser um UUID válido'),
  ies_nome: z.string().min(1, 'Nome da IES é obrigatório'),
  semestre: z.number()
    .int('Semestre deve ser um número inteiro')
    .min(1, 'Semestre deve ser pelo menos 1')
    .max(12, 'Semestre deve ser no máximo 12')
    .optional(),
});

// Schema para validação de conteúdo de estudo
export const studyContentSchema = z.object({
  id: z.string().min(1, 'ID é obrigatório'),
  name: z.string().min(1, 'Nome é obrigatório'),
  discipline: z.string().min(1, 'Disciplina é obrigatória'),
  week: z.number().int().min(1, 'Semana deve ser um número positivo'),
  sanarflixUrl: z.string().url('URL deve ser válida'),
  completed: z.boolean(),
  type: z.enum(['video', 'exercise', 'reading'], {
    errorMap: () => ({ message: 'Tipo deve ser video, exercise ou reading' })
  }),
});

// Schema para validação de progresso
export const progressSchema = z.object({
  userId: z.string().uuid('ID do usuário deve ser um UUID válido'),
  completedItems: z.array(z.string()),
  totalItems: z.number().int().min(0, 'Total de itens deve ser não-negativo'),
  progressByDiscipline: z.record(z.object({
    completed: z.number().int().min(0),
    total: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
  })),
});

// Schema para validação de login
export const loginSchema = z.object({
  email: z.string().email('Email deve ter um formato válido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

// Schema para validação de mudança de senha
export const changePasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Nova senha deve ter pelo menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

// Schema para validação de criação de usuário (gestão)
export const createUserSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email deve ter um formato válido'),
  id_ies: z.string().uuid('ID da IES deve ser um UUID válido'),
  semestre: z.number()
    .int('Semestre deve ser um número inteiro')
    .min(1, 'Semestre deve ser pelo menos 1')
    .max(12, 'Semestre deve ser no máximo 12'),
});

// Schema para validação de dados de API externa
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Funções utilitárias para validação
 */

export const validateUser = (data: unknown) => {
  return userSchema.safeParse(data);
};

export const validateStudyContent = (data: unknown) => {
  return studyContentSchema.safeParse(data);
};

export const validateProgress = (data: unknown) => {
  return progressSchema.safeParse(data);
};

export const validateLogin = (data: unknown) => {
  return loginSchema.safeParse(data);
};

export const validateChangePassword = (data: unknown) => {
  return changePasswordSchema.safeParse(data);
};

export const validateCreateUser = (data: unknown) => {
  return createUserSchema.safeParse(data);
};

export const validateApiResponse = (data: unknown) => {
  return apiResponseSchema.safeParse(data);
};

/**
 * Função genérica para validar dados com schema personalizado
 */
export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: string[];
} => {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }
  
  return {
    success: false,
    errors: result.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
  };
};

/**
 * Middleware para validação de formulários
 */
export const createFormValidator = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown) => {
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { errors };
    }
    
    return { data: result.data };
  };
};

/**
 * Validador para URLs do SanarFlix
 */
export const sanarflixUrlSchema = z.string().refine(
  (url) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.includes('sanar') || 
             parsedUrl.hostname.includes('localhost') ||
             parsedUrl.hostname.includes('127.0.0.1');
    } catch {
      return false;
    }
  },
  { message: 'URL deve ser do domínio SanarFlix' }
);

/**
 * Validador para CPF (se necessário no futuro)
 */
export const cpfSchema = z.string().refine(
  (cpf) => {
    // Remove caracteres não numéricos
    const cleanCpf = cpf.replace(/\D/g, '');
    
    // Verifica se tem 11 dígitos
    if (cleanCpf.length !== 11) return false;
    
    // Verifica se não são todos os dígitos iguais
    if (/^(\d)\1{10}$/.test(cleanCpf)) return false;
    
    // Validação do algoritmo do CPF
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cleanCpf.charAt(10))) return false;
    
    return true;
  },
  { message: 'CPF inválido' }
);

/**
 * Sanitização de dados de entrada
 */
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove caracteres HTML básicos
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, ''); // Remove event handlers
};

/**
 * Validação de arquivo CSV
 */
export const csvFileSchema = z.object({
  name: z.string().endsWith('.csv', { message: 'Arquivo deve ter extensão .csv' }),
  size: z.number().max(5 * 1024 * 1024, { message: 'Arquivo deve ter no máximo 5MB' }),
  type: z.string().refine((val) => val.includes('csv') || val === '', { message: 'Tipo de arquivo deve ser CSV' }),
});

export const validateCsvFile = (file: File) => {
  return csvFileSchema.safeParse({
    name: file.name,
    size: file.size,
    type: file.type,
  });
};