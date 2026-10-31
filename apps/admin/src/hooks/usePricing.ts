import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin.api';
import type { PricingFormData } from '../types';

// Chave de cache para o React Query
const PRICING_QUERY_KEY = ['pricing'];

/**
 * Hook para gerenciar o preço por Km (funcionalidade principal do 88 Mobility)
 */
export function usePricing() {
  const queryClient = useQueryClient();

  // Busca o preço atual
  const {
    data: currentPricing,
    isLoading: isLoadingPricing,
    error: pricingError,
  } = useQuery({
    queryKey: [...PRICING_QUERY_KEY, 'current'],
    queryFn: adminApi.getCurrentPricing,
    staleTime: 30_000, // 30 segundos
  });

  // Busca histórico de preços
  const {
    data: pricingHistory,
    isLoading: isLoadingHistory,
  } = useQuery({
    queryKey: [...PRICING_QUERY_KEY, 'history'],
    queryFn: adminApi.getPricingHistory,
    staleTime: 60_000, // 1 minuto
  });

  // Mutação para atualizar o preço
  const {
    mutateAsync: updatePricing,
    isPending: isUpdating,
    error: updateError,
  } = useMutation({
    mutationFn: (payload: PricingFormData) => adminApi.updatePricing(payload),
    onSuccess: () => {
      // Invalida cache para refetch automático após salvar
      queryClient.invalidateQueries({ queryKey: PRICING_QUERY_KEY });
    },
  });

  return {
    currentPricing,
    pricingHistory,
    isLoadingPricing,
    isLoadingHistory,
    pricingError,
    updatePricing,
    isUpdating,
    updateError,
  };
}
