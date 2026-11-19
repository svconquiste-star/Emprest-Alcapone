import { z } from 'zod';

export const submitContactSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Nome deve ter ao menos 2 caracteres')
    .max(255, 'Nome muito longo'),

  telefone: z
    .string()
    .transform((v) => String(v || '').replace(/\D/g, ''))
    .refine((d) => /^\d{10,13}$/.test(d), 'Telefone inválido (10-13 dígitos)')
    .transform((d) => (d.startsWith('55') ? d : `55${d}`)),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Email inválido')
    .optional()
    .or(z.literal('')),

  cidade: z
    .string()
    .trim()
    .min(2, 'Cidade deve ter ao menos 2 caracteres')
    .max(255, 'Cidade muito longa'),

  whatsappLink: z.string().url('Link WhatsApp inválido').optional(),
  deviceType: z.string().max(50).optional(),
  operatingSystem: z.string().max(50).optional(),
});
