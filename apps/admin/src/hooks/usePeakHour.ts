import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { adminApi } from '../api/admin.api';
import type { PeakHourConfig, PeakHourStatus } from '../types';

const QUERY_KEY = ['pricing', 'peak-hours'];

// Configuração padrão (mock) usada enquanto o backend não retorna dados
export const DEFAULT_PEAK_CONFIG: PeakHourConfig = {
  id: 'peak-001',
  enabled: true,
  surgeAmount: 2.00,    // R$ 2,00 por corrida
  surgeType: 'per_ride',
  slots: [
    { start: '07:00', end: '09:00' }, // Manhã
    { start: '17:00', end: '19:30' }, // Tarde
  ],
  weekdays: [1, 2, 3, 4, 5], // Seg–Sex
  updatedAt: new Date().toISOString(),
  updatedBy: 'Admin',
};

/**
 * Verifica se um horário "HH:mm" está dentro de um slot de pico
 * Retorna o slot ativo ou undefined
 */
export function getActivePeakSlot(
  config: PeakHourConfig
): PeakHourConfig['slots'][number] | undefined {
  if (!config.enabled) return undefined;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Dom … 6=Sáb
  if (!config.weekdays.includes(dayOfWeek)) return undefined;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return config.slots.find((slot) => {
    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });
}

/**
 * Retorna o próximo slot de pico do dia (ou undefined se não houver mais)
 */
export function getNextPeakSlot(
  config: PeakHourConfig
): PeakHourConfig['slots'][number] | undefined {
  if (!config.enabled) return undefined;

  const now = new Date();
  const dayOfWeek = now.getDay();
  if (!config.weekdays.includes(dayOfWeek)) return undefined;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return config.slots.find((slot) => {
    const [startH, startM] = slot.start.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    return startMinutes > currentMinutes;
  });
}

/**
 * Hook principal de horário de pico:
 * - Busca configuração da API (com fallback mock)
 * - Calcula em tempo real se está em pico agora (atualiza a cada minuto)
 * - Expõe mutações para salvar e fazer toggle
 */
export function usePeakHour() {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());

  // Atualiza o relógio a cada 30 segundos para manter status preciso
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Busca configuração de pico
  const { data: config, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: adminApi.getPeakHourConfig,
    placeholderData: DEFAULT_PEAK_CONFIG,
    retry: false,
    staleTime: 60_000,
  });

  const peakConfig = config ?? DEFAULT_PEAK_CONFIG;

  // Calcula status atual baseado no horário agora
  const peakStatus: PeakHourStatus = (() => {
    const currentSlot = getActivePeakSlot(peakConfig);
    const nextSlot = getNextPeakSlot(peakConfig);
    return {
      isActive: !!currentSlot,
      currentSlot,
      nextSlot,
      effectivePrice: 0, // preenchido por quem consome
      surgeFee: currentSlot ? peakConfig.surgeAmount : 0,
    };
  })();

  // Mutação: salvar nova configuração
  const { mutateAsync: savePeakConfig, isPending: isSaving } = useMutation({
    mutationFn: (payload: Omit<PeakHourConfig, 'id' | 'updatedAt' | 'updatedBy'>) =>
      adminApi.updatePeakHourConfig(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // Mutação: toggle rápido (ativa/desativa sem abrir formulário)
  const { mutateAsync: togglePeak, isPending: isToggling } = useMutation({
    mutationFn: (enabled: boolean) => adminApi.togglePeakHour(enabled),
    // Optimistic update: atualiza o cache imediatamente
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<PeakHourConfig>(QUERY_KEY);
      queryClient.setQueryData<PeakHourConfig>(QUERY_KEY, (old) =>
        old ? { ...old, enabled } : DEFAULT_PEAK_CONFIG
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Reverte em caso de erro
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    peakConfig,
    peakStatus,
    isLoading,
    savePeakConfig,
    isSaving,
    togglePeak,
    isToggling,
    now, // expõe para re-render automático
  };
}
