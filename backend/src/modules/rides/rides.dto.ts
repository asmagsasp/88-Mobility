import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

// ============================================================
// DTOs do módulo de Corridas
// ============================================================

/**
 * Schema para estimar uma corrida (antes de solicitar)
 */
export const estimateRideSchema = z.object({
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
});

export type EstimateRideDto = z.infer<typeof estimateRideSchema>;

/**
 * Schema para solicitar uma corrida
 */
export const requestRideSchema = z.object({
  originLat: z.number().min(-90).max(90),
  originLng: z.number().min(-180).max(180),
  originAddress: z.string().min(5, 'Endereço de origem inválido'),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
  destinationAddress: z.string().min(5, 'Endereço de destino inválido'),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
});

export type RequestRideDto = z.infer<typeof requestRideSchema>;

/**
 * Schema para completar uma corrida (motorista informa Km real)
 */
export const completeRideSchema = z.object({
  actualKm: z.number().positive('Km rodado deve ser positivo'),
});

export type CompleteRideDto = z.infer<typeof completeRideSchema>;

/**
 * Schema para cancelar uma corrida
 */
export const cancelRideSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CancelRideDto = z.infer<typeof cancelRideSchema>;
