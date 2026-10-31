import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DollarSign, TrendingUp, AlertCircle, Check, History, Calculator, Zap } from 'lucide-react';
import { adminApi } from '../api/admin.api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { PeakHourSection } from '../components/pricing/PeakHourSection';
import { usePeakHour } from '../hooks/usePeakHour';
import { clsx } from 'clsx';
import type { PricingConfig } from '../types';

// ── Dados mock ──────────────────────────────────────────────────────────────
const MOCK_CURRENT_PRICING: PricingConfig = {
  id: 'p1',
  pricePerKm: 2.50,
  platformFee: 2.00,
  setBy: 'Admin',
  setAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
};

const MOCK_HISTORY: PricingConfig[] = [
  { id: 'p1', pricePerKm: 2.50, platformFee: 2.00, setBy: 'Admin', setAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Ajuste de mercado' },
  { id: 'p2', pricePerKm: 2.20, platformFee: 2.00, setBy: 'Admin', setAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Promoção de lançamento' },
  { id: 'p3', pricePerKm: 2.80, platformFee: 2.00, setBy: 'Admin', setAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() },
  { id: 'p4', pricePerKm: 3.00, platformFee: 2.00, setBy: 'Admin', setAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(), notes: 'Alta demanda - horário de pico' },
];

// ── Schema Zod ──────────────────────────────────────────────────────────────
const pricingSchema = z.object({
  pricePerKm: z
    .number({ message: 'Informe um valor válido' })
    .min(0.5, 'Mínimo R$ 0,50/km')
    .max(10, 'Máximo R$ 10,00/km'),
  platformFee: z
    .number({ message: 'Informe um valor válido' })
    .min(0, 'Mínimo R$ 0,00')
    .max(50, 'Máximo R$ 50,00'),
  notes: z.string().optional(),
});

type PricingFormData = z.infer<typeof pricingSchema>;

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (isoDate: string) =>
  new Date(isoDate).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/**
 * PricingPage — Tela de Configuração de Preço por Km + Horário de Pico
 */
export function PricingPage() {
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [simulatorKm, setSimulatorKm] = useState(10);
  const [pendingData, setPendingData] = useState<PricingFormData | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Hook de pico — traz status em tempo real
  const { peakConfig, peakStatus } = usePeakHour();

  // Preço atual por km
  const { data: currentPricing } = useQuery({
    queryKey: ['pricing', 'current'],
    queryFn: adminApi.getCurrentPricing,
    placeholderData: MOCK_CURRENT_PRICING,
    retry: false,
  });

  // Histórico de preços
  const { data: pricingHistory } = useQuery({
    queryKey: ['pricing', 'history'],
    queryFn: adminApi.getPricingHistory,
    placeholderData: MOCK_HISTORY,
    retry: false,
  });

  // Mutação para salvar novo preço base
  const { mutateAsync, isPending } = useMutation({
    mutationFn: adminApi.updatePricing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] });
      setSavedSuccess(true);
      setShowConfirm(false);
      setPendingData(null);
      setTimeout(() => setSavedSuccess(false), 4000);
    },
  });

  const displayPricing = currentPricing ?? MOCK_CURRENT_PRICING;
  const displayHistory = pricingHistory ?? MOCK_HISTORY;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    defaultValues: {
      pricePerKm: displayPricing.pricePerKm,
      platformFee: displayPricing.platformFee ?? 2.00,
    },
  });

  const watchedPrice = watch('pricePerKm') || displayPricing.pricePerKm;
  const watchedFee   = watch('platformFee') ?? (displayPricing.platformFee ?? 2.00);

  // ── Simulador (cálculo local, sem API) ─────────────────────────────────────
  const simulation = useMemo(() => {
    const km = simulatorKm;
    const pricePerKm  = typeof watchedPrice === 'number' ? watchedPrice : displayPricing.pricePerKm;
    const platformFee = typeof watchedFee   === 'number' ? watchedFee   : (displayPricing.platformFee ?? 2.00);
    const surgeFee    = peakStatus.isActive ? peakConfig.surgeAmount : 0;
    const kmTotal     = km * pricePerKm;
    const total       = kmTotal + surgeFee + platformFee;
    // 88% sobre valor Km; taxa fixa vai integralmente à plataforma
    const driverEarning   = kmTotal * 0.88;
    const platformEarning = kmTotal * 0.12 + platformFee + surgeFee;
    return { pricePerKm, platformFee, surgeFee, kmTotal, total, driverEarning, platformEarning };
  }, [simulatorKm, watchedPrice, watchedFee, displayPricing, peakStatus.isActive, peakConfig.surgeAmount]);

  const onSubmit = (data: PricingFormData) => {
    setPendingData(data);
    setShowConfirm(true);
  };

  const confirmSave = async () => {
    if (!pendingData) return;
    await mutateAsync(pendingData);
  };

  // Colunas do histórico
  const historyColumns = [
    {
      key: 'pricePerKm',
      header: 'Preço/Km',
      render: (p: PricingConfig) => (
        <span className="font-semibold text-brand-amber">{formatBRL(p.pricePerKm)}/km</span>
      ),
    },
    { key: 'setBy', header: 'Definido por' },
    {
      key: 'setAt',
      header: 'Data',
      render: (p: PricingConfig) => formatDate(p.setAt),
    },
    {
      key: 'notes',
      header: 'Observações',
      render: (p: PricingConfig) => <span className="text-slate-400 text-xs">{p.notes ?? '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Banner de sucesso */}
      {savedSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-900/30 border border-green-700 rounded-xl text-green-400">
          <Check size={18} />
          <span className="font-medium">Novo preço salvo! Todas as corridas futuras usarão o novo valor.</span>
        </div>
      )}

      {/* ── Preço atual em destaque ── */}
      <div className="bg-gradient-to-br from-brand-amber/20 via-brand-dark-card to-brand-dark-card border border-brand-amber/40 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">
            <DollarSign size={16} className="text-brand-amber" />
            Preço base por Km
          </p>
          <div className="text-6xl font-black text-brand-amber tracking-tight">
            R$ {displayPricing.pricePerKm.toFixed(2).replace('.', ',')}
            <span className="text-2xl font-medium text-slate-400 ml-2">/ km</span>
          </div>

          {/* Badge de pico ativo */}
          {peakStatus.isActive && (
            <div className="mt-3 inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/40 rounded-xl px-3 py-2">
              <Zap size={16} className="text-orange-400" />
              <span className="text-orange-300 text-sm font-medium">
                Pico ativo · +{formatBRL(peakConfig.surgeAmount)} por corrida
              </span>
              <span className="text-orange-400/60 text-xs">
                ({peakStatus.currentSlot?.start}–{peakStatus.currentSlot?.end})
              </span>
            </div>
          )}

          <p className="text-slate-500 text-xs mt-3">
            Definido em {formatDate(displayPricing.setAt)} por {displayPricing.setBy}
          </p>
          {/* Taxa fixa de manutenção em destaque */}
          <div className="mt-3 inline-flex items-center gap-2 bg-slate-700/50 border border-slate-600 rounded-xl px-3 py-2">
            <span className="text-slate-400 text-sm">🛡️ Taxa de manutenção</span>
            <span className="text-white font-bold text-sm">{formatBRL(displayPricing.platformFee ?? 2.00)}</span>
            <span className="text-slate-500 text-xs">por corrida</span>
          </div>
        </div>

        {/* Split 88/12 */}
        <div className="flex flex-col gap-3 min-w-[200px]">
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Split de receita</div>
          <div className="bg-brand-dark rounded-xl p-4 border border-brand-dark-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-300">Motorista</span>
              <span className="text-lg font-bold text-white">88%</span>
            </div>
            <div className="w-full bg-brand-dark-border rounded-full h-2">
              <div className="bg-brand-amber h-2 rounded-full" style={{ width: '88%' }} />
            </div>
            <div className="flex justify-between items-center mt-3">
              <span className="text-sm text-slate-300">Plataforma</span>
              <span className="text-lg font-bold text-slate-400">12%</span>
            </div>
            <div className="w-full bg-brand-dark-border rounded-full h-2">
              <div className="bg-slate-600 h-2 rounded-full" style={{ width: '12%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Simulador de corrida ── */}
      <Card
        title="Simulador de Corrida"
        subtitle="Calcule o valor considerando preço base + acréscimo de pico"
        rightContent={<Calculator size={20} className="text-brand-amber" />}
      >
        <div className="space-y-4">
          {/* Slider de Km */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Distância da corrida</label>
              <span className="text-brand-amber font-semibold">{simulatorKm} km</span>
            </div>
            <input
              type="range" min={0.5} max={50} step={0.5}
              value={simulatorKm}
              onChange={(e) => setSimulatorKm(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
                         [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-brand-amber
                         [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              style={{ background: `linear-gradient(to right, #F59E0B ${(simulatorKm / 50) * 100}%, #334155 ${(simulatorKm / 50) * 100}%)` }}
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>0,5 km</span><span>50 km</span>
            </div>
          </div>

          {/* Toggle "simular com pico" */}
          <div className="flex items-center gap-3 text-sm text-slate-400 select-none">
            <Zap size={15} className={clsx(peakStatus.isActive ? 'text-orange-400' : 'text-slate-600')} />
            {peakStatus.isActive
              ? <span className="text-orange-400 font-medium">Horário de pico ativo — acréscimo incluído automaticamente</span>
              : <span>Fora do horário de pico — sem acréscimo</span>
            }
          </div>

          {/* Breakdown detalhado */}
          <div className="bg-brand-dark rounded-xl border border-brand-dark-border overflow-hidden">
            {/* Linha de cálculo */}
            <div className="px-4 py-3 border-b border-brand-dark-border">
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Composição do valor</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>{simulatorKm} km × {formatBRL(simulation.pricePerKm)}/km</span>
                  <span>{formatBRL(simulation.kmTotal)}</span>
                </div>
                {simulation.surgeFee > 0 && (
                  <div className="flex justify-between text-orange-400">
                    <span className="flex items-center gap-1.5">
                      <Zap size={13} /> Acréscimo de pico
                    </span>
                    <span>+ {formatBRL(simulation.surgeFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span className="flex items-center gap-1.5">🛡️ Taxa de manutenção</span>
                  <span>+ {formatBRL(simulation.platformFee)}</span>
                </div>
              </div>
            </div>

            {/* Cards de resultado */}
            <div className="grid grid-cols-3 divide-x divide-brand-dark-border">
              <div className="p-4 text-center">
                <p className="text-xs text-slate-400 mb-1">Valor total</p>
                <p className={clsx('text-2xl font-bold', simulation.surgeFee > 0 ? 'text-orange-300' : 'text-white')}>
                  {formatBRL(simulation.total)}
                </p>
              </div>
              <div className="p-4 text-center bg-green-900/10">
                <p className="text-xs text-green-400 mb-1">Motorista (88%)</p>
                <p className="text-2xl font-bold text-green-400">{formatBRL(simulation.driverEarning)}</p>
              </div>
              <div className="p-4 text-center bg-brand-amber/5">
                <p className="text-xs text-brand-amber mb-1">Plataforma (12%)</p>
                <p className="text-2xl font-bold text-brand-amber">{formatBRL(simulation.platformEarning)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Seção de Horário de Pico ── */}
      <PeakHourSection />

      {/* ── Formulário: alterar preço base ── */}
      <Card
        title="Alterar Preço Base por Km"
        subtitle="O novo preço será aplicado imediatamente a todas as corridas futuras"
        rightContent={<TrendingUp size={20} className="text-brand-amber" />}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Novo preço por Km (R$)
            </label>
            <div className="relative w-full max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
              <input
                type="number" step="0.01" min="0.50" max="10.00" placeholder="2,50"
                className={`w-full bg-brand-dark border rounded-lg pl-10 pr-4 py-3 text-white text-xl font-bold
                            placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all
                            ${errors.pricePerKm ? 'border-red-500 focus:ring-red-500' : 'border-brand-dark-border focus:ring-brand-amber'}`}
                {...register('pricePerKm', { valueAsNumber: true })}
              />
            </div>
            {errors.pricePerKm && (
              <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle size={14} /> {errors.pricePerKm.message}
              </p>
            )}

            {/* Slider do preço */}
            <div className="mt-4 max-w-xs">
              <input
                type="range" min="0.5" max="10" step="0.1"
                value={watchedPrice || displayPricing.pricePerKm}
                onChange={(e) => setValue('pricePerKm', Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5
                           [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-brand-amber
                           [&::-webkit-slider-thumb]:rounded-full"
                style={{
                  background: `linear-gradient(to right, #F59E0B ${((Number(watchedPrice || displayPricing.pricePerKm) - 0.5) / 9.5) * 100}%, #334155 ${((Number(watchedPrice || displayPricing.pricePerKm) - 0.5) / 9.5) * 100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>R$ 0,50</span><span>R$ 10,00</span>
              </div>
            </div>
          </div>

          {/* Preview impacto */}
          {watchedPrice && watchedPrice !== displayPricing.pricePerKm && (
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-xl p-4 text-sm text-blue-300 max-w-lg">
              <p className="font-medium mb-1">📊 Preview do impacto (10 km):</p>
              <p>
                Base: <strong>{formatBRL(watchedPrice * 10)}</strong>
                {peakConfig.enabled && (
                  <> · Com pico: <strong className="text-orange-300">{formatBRL(watchedPrice * 10 + peakConfig.surgeAmount)}</strong></>
                )}
                <br />
                + Taxa de manutenção: <strong>{formatBRL(watchedFee)}</strong>
                <br />
                Motorista recebe: <strong>{formatBRL((watchedPrice * 10) * 0.88)}</strong> · Plataforma: <strong>{formatBRL((watchedPrice * 10) * 0.12 + watchedFee)}</strong>
              </p>
            </div>
          )}

          {/* Taxa fixa de manutenção */}
          <div className="border-t border-brand-dark-border pt-5">
            <label className="block text-sm font-medium text-slate-300 mb-1">
              🛡️ Taxa de manutenção da plataforma
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Valor fixo cobrado por corrida, independente da distância. Vai integralmente para a plataforma.
            </p>
            <div className="relative max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">R$</span>
              <input
                type="number" step="0.50" min="0" max="50" placeholder="2,00"
                className={`w-full bg-brand-dark border rounded-lg pl-10 pr-4 py-3 text-white text-xl font-bold
                            placeholder-slate-600 focus:outline-none focus:ring-2 focus:border-transparent transition-all
                            ${errors.platformFee ? 'border-red-500 focus:ring-red-500' : 'border-brand-dark-border focus:ring-brand-amber'}`}
                {...register('platformFee', { valueAsNumber: true })}
              />
            </div>
            {errors.platformFee && (
              <p className="mt-1.5 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle size={14} /> {errors.platformFee.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Observação (opcional)</label>
            <input
              type="text" placeholder="Ex: Ajuste de demanda no horário de pico..."
              className="w-full bg-brand-dark border border-brand-dark-border text-white rounded-lg px-4 py-2.5
                         placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-amber focus:border-transparent"
              {...register('notes')}
            />
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={isPending}>
            Salvar novo preço base
          </Button>
        </form>
      </Card>

      {/* ── Histórico de preços ── */}
      <Card
        title="Histórico de Configurações"
        subtitle="Últimas alterações de preço base realizadas no painel"
        noPadding
        rightContent={<History size={18} className="text-slate-400" />}
      >
        <div className="px-6 pb-4">
          <Table
            columns={historyColumns}
            data={displayHistory}
            keyExtractor={(p) => p.id}
            emptyMessage="Nenhuma alteração de preço registrada"
          />
        </div>
      </Card>

      {/* ── Modal de confirmação ── */}
      {showConfirm && pendingData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-brand-dark-card border border-brand-dark-border rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Confirmar alteração de preço</h3>
            <p className="text-slate-400 mb-6">
              Novo preço base:{' '}
              <strong className="text-brand-amber text-xl">{formatBRL(pendingData.pricePerKm)}/km</strong>
              {peakConfig.enabled && (
                <span className="block mt-1 text-sm text-orange-400">
                  + acréscimo de pico: {formatBRL(peakConfig.surgeAmount)}/corrida quando ativo
                </span>
              )}
            </p>
            {pendingData.notes && (
              <div className="bg-brand-dark rounded-lg p-3 mb-6 text-sm text-slate-300">
                📝 {pendingData.notes}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setShowConfirm(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button variant="primary" className="flex-1" isLoading={isPending} onClick={confirmSave}>
                Confirmar e Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
