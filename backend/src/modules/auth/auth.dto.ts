import { z } from 'zod';
import { PaymentMethod } from '../../shared/types/enums';

// ============================================================
// DTOs (Data Transfer Objects) do módulo de Auth
// Validados com Zod para garantir integridade dos dados
// ============================================================

/**
 * Schema para registro de passageiro
 */
export const registerPassengerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  email: z.string().email('Email inválido'),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{10,14}$/, 'Telefone inválido (use formato internacional: +5511999999999)'),
  password: z
    .string()
    .min(8, 'Senha deve ter ao menos 8 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter ao menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter ao menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter ao menos um número')
    .regex(/[^A-Za-z0-9]/, 'Senha deve conter ao menos um caractere especial (!@#$%^&*)'),
});

export type RegisterPassengerDto = z.infer<typeof registerPassengerSchema>;

/**
 * Schema para registro de motorista (inclui dados do veículo)
 */
export const registerDriverSchema = registerPassengerSchema.extend({
  licenseNumber: z.string().min(5, 'Número de habilitação inválido'),
  licenseExpiry: z.string().datetime({ message: 'Data de vencimento inválida (ISO 8601)' }),
  vehiclePlate: z
    .string()
    .regex(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, 'Placa inválida (ex: ABC1D23 ou ABC1234)'),
  vehicleModel: z.string().min(2).max(100),
  vehicleYear: z
    .number()
    .int()
    .min(2000, 'Veículo muito antigo')
    .max(new Date().getFullYear() + 1),
  vehicleColor: z.string().min(2).max(50),
});

export type RegisterDriverDto = z.infer<typeof registerDriverSchema>;

/**
 * Schema para login
 */
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

export type LoginDto = z.infer<typeof loginSchema>;

/**
 * Schema para refresh de token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório'),
});

export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

/**
 * Schema para atualização de perfil
 */
export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{10,14}$/)
    .optional(),
  avatar: z.string().url().optional(),
  defaultPaymentMethod: z.nativeEnum(PaymentMethod).optional(),
});

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
